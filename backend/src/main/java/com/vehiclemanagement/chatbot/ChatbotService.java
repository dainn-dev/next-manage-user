package com.vehiclemanagement.chatbot;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.*;
import com.vehiclemanagement.entity.User;
import io.micrometer.core.instrument.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.regex.*;

@Service @ConditionalOnProperty(name="chatbot.enabled",havingValue="true")
public class ChatbotService {
 private static final Set<String> TOOLS=Set.of("getVehicleLocation","getHistory","getSnapshot","getParkingStatus");
 private static final Pattern INJECTION=Pattern.compile("(?i)(ignore (all |the )?(previous|system)|reveal (the )?(system|prompt)|jailbreak|bypass (authorization|rbac)|change (the )?tenant|tenant[_ -]?id|select\\s+.+\\s+from|drop\\s+table|bỏ qua (mọi |các )?hướng dẫn|đổi (khách thuê|tenant))");
 private static final Pattern PLATE=Pattern.compile("(?i)(?<![A-Z0-9])(\\d{2}[A-Z]{1,2})[- .]?(\\d{4,6})(?![A-Z0-9])");
 private final ChatProvider provider;private final ChatbotToolGateway tools;private final JdbcTemplate jdbc;private final ObjectMapper json;
 private final Counter requests,denied,failures,fallbacks;private final int minuteLimit,retentionDays;private final long costPerThousandMicros;
 public ChatbotService(ChatProvider provider,ChatbotToolGateway tools,JdbcTemplate jdbc,ObjectMapper json,MeterRegistry metrics,
  @Value("${chatbot.rate-limit-per-minute:10}") int minuteLimit,@Value("${chatbot.retention-days:30}") int retentionDays,
  @Value("${chatbot.estimated-cost-per-thousand-tokens-micros:0}") long costPerThousandMicros){
  this.provider=provider;this.tools=tools;this.jdbc=jdbc;this.json=json;this.minuteLimit=minuteLimit;this.retentionDays=retentionDays;this.costPerThousandMicros=costPerThousandMicros;
  requests=metrics.counter("chatbot.requests","outcome","success");denied=metrics.counter("chatbot.requests","outcome","denied");failures=metrics.counter("chatbot.requests","outcome","failed");fallbacks=metrics.counter("chatbot.model.fallback");
 }

 @Transactional public ChatResponse chat(User user,UUID selectedSite,UUID requestedConversation,String message,String locale){
  if(user==null||TenantContext.getTenantId()==null)throw new SecurityException("AUTHENTICATION_REQUIRED");
  String text=message==null?"":message.strip();if(text.isBlank()||text.length()>2000)throw new IllegalArgumentException("Message must contain 1 to 2000 characters");
  tools.assertSite(selectedSite);
  UUID conversation=conversation(user,selectedSite,requestedConversation,locale);assertRateAndPlan(user.getId());persistMessage(conversation,user.getId(),"USER",redact(text),null,text.length()/4,0);
  if(isInjection(text)){denied.increment();audit(conversation,user.getId(),selectedSite,"NONE",Map.of(),"DENIED",0,"guardrail",0,"PROMPT_INJECTION");return safe(conversation,"Yêu cầu bị từ chối vì chứa chỉ dẫn có thể vượt qua phạm vi truy cập.","guardrail");}
  long started=System.nanoTime();ChatProvider.ToolPlan plan;
  try{plan=sanitize(provider.plan(text));}catch(Exception ex){fallbacks.increment();plan=fallback(text);}
  if(!TOOLS.contains(plan.toolName())){denied.increment();audit(conversation,user.getId(),selectedSite,plan.toolName(),Map.of(),"DENIED",elapsed(started),plan.model(),cost(plan),"TOOL_NOT_ALLOWED");return safe(conversation,"Tôi chỉ có thể tra cứu vị trí xe, lịch sử, ảnh gần nhất hoặc tình trạng bãi đỗ.",plan.model());}
  try{
   ChatbotToolGateway.ToolResult result=tools.execute(plan.toolName(),plan.arguments(),selectedSite);long latency=elapsed(started);long cost=cost(plan);
   audit(conversation,user.getId(),selectedSite,plan.toolName(),result.filteredArguments(),"SUCCESS",latency,plan.model(),cost,null);meterUsage();
   String answer=answer(result);persistMessage(conversation,user.getId(),"ASSISTANT",redact(answer),plan.model(),plan.inputTokens(),plan.outputTokens());requests.increment();
   return new ChatResponse(conversation,answer,result.tool(),result.freshAt(),result.source(),plan.model(),result.data(),"rule-based-fallback".equals(plan.model()));
  }catch(SecurityException|org.springframework.security.access.AccessDeniedException|com.vehiclemanagement.exception.ResourceNotFoundException ex){denied.increment();audit(conversation,user.getId(),null,plan.toolName(),Map.of(),"DENIED",elapsed(started),plan.model(),cost(plan),"ACCESS_DENIED");throw ex;
  }catch(Exception ex){failures.increment();audit(conversation,user.getId(),selectedSite,plan.toolName(),Map.of(),"FAILED",elapsed(started),plan.model(),cost(plan),"TOOL_FAILURE");return safe(conversation,"Không thể lấy dữ liệu có thẩm quyền lúc này. Vui lòng thử lại sau.",plan.model());}
 }

 private UUID conversation(User user,UUID site,UUID requested,String locale){
  if(site==null)throw new IllegalArgumentException("siteId is required");
  if(requested!=null){Boolean owned=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM chatbot_conversation WHERE id=? AND tenant_id=? AND user_id=? AND site_id=?)",Boolean.class,requested,TenantContext.getTenantId(),user.getId(),site);if(!Boolean.TRUE.equals(owned))throw new SecurityException("CONVERSATION_NOT_FOUND");return requested;}
  UUID id=UUID.randomUUID();jdbc.update("INSERT INTO chatbot_conversation(id,tenant_id,user_id,site_id,locale) VALUES(?,?,?,?,?)",id,TenantContext.getTenantId(),user.getId(),site,locale==null?"vi":locale);return id;
 }
 private void assertRateAndPlan(UUID user){
  Long recent=jdbc.queryForObject("SELECT count(*) FROM chatbot_message WHERE tenant_id=? AND user_id=? AND role='USER' AND created_at>now()-interval '1 minute'",Long.class,TenantContext.getTenantId(),user);
  if(recent!=null&&recent>=minuteLimit)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"CHATBOT_RATE_LIMITED");
  Long limit=jdbc.query("SELECT (p.limits->>'chatbot_messages_month')::bigint FROM tenant t JOIN billing_plan p ON p.id=t.plan_id WHERE t.id=?",rs->rs.next()?(Long)rs.getObject(1):null,TenantContext.getTenantId());
  Long used=jdbc.query("SELECT qty FROM billing_usage_record WHERE tenant_id=? AND metric='chatbot_messages_month' AND period=?",rs->rs.next()?rs.getLong(1):0L,TenantContext.getTenantId(),YearMonth.now(ZoneOffset.UTC).toString());
  if(limit!=null&&used!=null&&used>=limit)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"CHATBOT_MONTHLY_LIMIT_REACHED");
 }
 private void meterUsage(){jdbc.update("INSERT INTO billing_usage_record(tenant_id,metric,qty,period) VALUES(?,'chatbot_messages_month',1,?) ON CONFLICT(tenant_id,metric,period) DO UPDATE SET qty=billing_usage_record.qty+1,updated_at=now()",TenantContext.getTenantId(),YearMonth.now(ZoneOffset.UTC).toString());}
 private void persistMessage(UUID c,UUID u,String role,String content,String model,int in,int out){jdbc.update("INSERT INTO chatbot_message(tenant_id,conversation_id,user_id,role,redacted_content,model,input_tokens,output_tokens) VALUES(?,?,?,?,?,?,?,?)",TenantContext.getTenantId(),c,u,role,content,model,in,out);jdbc.update("UPDATE chatbot_conversation SET updated_at=now() WHERE id=?",c);}
 private void audit(UUID c,UUID u,UUID site,String tool,Map<String,Object> args,String outcome,long latency,String model,long cost,String error){try{jdbc.update("INSERT INTO chatbot_tool_audit(tenant_id,conversation_id,user_id,site_id,tool_name,filtered_arguments,outcome,latency_ms,model,estimated_cost_micros,error_code) VALUES(?,?,?,?,?,CAST(? AS jsonb),?,?,?,?,?)",TenantContext.getTenantId(),c,u,site,tool,json.writeValueAsString(args),outcome,latency,model,cost,error);}catch(JsonProcessingException ex){throw new IllegalStateException("AUDIT_SERIALIZATION_FAILED",ex);}}
 private ChatResponse safe(UUID c,String answer,String model){persistMessage(c,currentUser(),"ASSISTANT",answer,model,0,0);return new ChatResponse(c,answer,null,OffsetDateTime.now(ZoneOffset.UTC),"guardrail",model,Map.of(),"rule-based-fallback".equals(model));}
 private UUID currentUser(){var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();return auth!=null&&auth.getPrincipal() instanceof User u?u.getId():null;}
 private ChatProvider.ToolPlan sanitize(ChatProvider.ToolPlan p){Map<String,String> args=new LinkedHashMap<>();if(p.arguments()!=null){if(p.arguments().containsKey("plate"))args.put("plate",p.arguments().get("plate"));if(p.arguments().containsKey("limit"))args.put("limit",p.arguments().get("limit"));}return new ChatProvider.ToolPlan(p.toolName(),Map.copyOf(args),p.model(),p.inputTokens(),p.outputTokens());}
 static boolean isInjection(String text){return INJECTION.matcher(text).find();}
 static ChatProvider.ToolPlan fallback(String text){String lower=text.toLowerCase(Locale.ROOT);String tool=lower.matches(".*(bao nhiêu|còn chỗ|tình trạng bãi|parking status|available).*" )?"getParkingStatus":lower.matches(".*(ảnh|snapshot|photo).*" )?"getSnapshot":lower.matches(".*(lịch sử|history|đã đi|di chuyển).*" )?"getHistory":lower.matches(".*(ở đâu|vị trí|where|location).*" )?"getVehicleLocation":"NONE";Matcher m=PLATE.matcher(text);Map<String,String> args=m.find()?Map.of("plate",m.group(1)+m.group(2)):Map.of();return new ChatProvider.ToolPlan(tool,args,"rule-based-fallback",Math.max(1,text.length()/4),10);}
 static String redact(String text){Matcher m=PLATE.matcher(text);StringBuffer out=new StringBuffer();while(m.find()){String p=m.group(1)+m.group(2);m.appendReplacement(out,Matcher.quoteReplacement(ChatbotToolGateway.mask(p)));}m.appendTail(out);return out.toString();}
 private String answer(ChatbotToolGateway.ToolResult r){Map<String,Object>d=r.data();return switch(r.tool()){
  case "getVehicleLocation"->Boolean.TRUE.equals(d.get("found"))?"Xe "+d.get("plate")+" đang ở ô "+Objects.toString(d.get("slotCode"),"chưa xác định")+", dữ liệu lúc "+Objects.toString(d.get("lastSeenAt"),r.freshAt().toString())+".":"Không tìm thấy vị trí hiện tại của xe trong site đã chọn.";
  case "getHistory"->"Tìm thấy "+d.get("count")+" sự kiện gần nhất. Dữ liệu có thẩm quyền lúc "+r.freshAt()+".";
  case "getSnapshot"->Boolean.TRUE.equals(d.get("found"))?"Đây là ảnh gần nhất, ghi nhận lúc "+d.get("capturedAt")+": "+d.get("snapshotUrl"):"Không tìm thấy ảnh trong site đã chọn.";
  case "getParkingStatus"->"Bãi có "+d.get("available")+"/"+d.get("total")+" chỗ trống (đang sử dụng "+d.get("occupancyPercent")+"%), cập nhật "+r.freshAt()+".";
  default->"Không có dữ liệu.";};}
 private long cost(ChatProvider.ToolPlan p){return (p.inputTokens()+p.outputTokens())*costPerThousandMicros/1000;}
 private long elapsed(long start){return Duration.ofNanos(System.nanoTime()-start).toMillis();}

 @Scheduled(cron="${chatbot.retention-cron:0 30 2 * * *}") @PlatformAdminOperation @Transactional
 public void purgeExpired(){jdbc.update("DELETE FROM chatbot_conversation WHERE updated_at<?",Timestamp.from(Instant.now().minus(Duration.ofDays(retentionDays))));}
 public record ChatResponse(UUID conversationId,String answer,String tool,OffsetDateTime freshAt,String source,String model,Map<String,Object> data,boolean fallback){}
}
