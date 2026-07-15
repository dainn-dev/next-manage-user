package com.vehiclemanagement.chatbot;

import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.security.SiteAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1/chat")
@ConditionalOnProperty(name="chatbot.enabled",havingValue="true")
public class ChatbotController {
 private final ChatbotService service;private final JdbcTemplate jdbc;private final SiteAccess siteAccess;
 public ChatbotController(ChatbotService service,JdbcTemplate jdbc,SiteAccess siteAccess){this.service=service;this.jdbc=jdbc;this.siteAccess=siteAccess;}

 @PostMapping @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
 public ChatbotService.ChatResponse chat(@AuthenticationPrincipal User user,@Valid @RequestBody ChatRequest request){
  siteAccess.assertSiteAllowed(request.siteId());return service.chat(user,request.siteId(),request.conversationId(),request.message(),request.locale());
 }

 @GetMapping("/audits") @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')") @Transactional(readOnly=true)
 public List<Map<String,Object>> audits(@RequestParam UUID siteId,@RequestParam(required=false) String outcome){
  siteAccess.assertSiteAllowed(siteId);return jdbc.queryForList("""
   SELECT id,conversation_id,user_id,site_id,tool_name,filtered_arguments,outcome,latency_ms,
          model,estimated_cost_micros,error_code,created_at
     FROM chatbot_tool_audit WHERE site_id=? AND (? IS NULL OR outcome=?) ORDER BY created_at DESC LIMIT 200
   """,siteId,outcome,outcome);
 }

 public record ChatRequest(@NotNull UUID siteId,UUID conversationId,@NotBlank @Size(max=2000) String message,
                           @Pattern(regexp="vi|en") String locale){}
}
