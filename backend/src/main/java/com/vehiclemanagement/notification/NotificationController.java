package com.vehiclemanagement.notification;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.security.SiteAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Time;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;

@RestController
@RequestMapping("/api/v1/notifications")
@ConditionalOnProperty(name="notification.enabled", havingValue="true")
public class NotificationController {
    private final JdbcTemplate jdbc;
    private final SiteAccess siteAccess;
    public NotificationController(JdbcTemplate jdbc, SiteAccess siteAccess){this.jdbc=jdbc;this.siteAccess=siteAccess;}

    @GetMapping
    @Transactional(readOnly=true)
    public List<Map<String,Object>> inbox(@AuthenticationPrincipal User user,
            @RequestParam(defaultValue="50") int limit) {
        return jdbc.queryForList("""
                SELECT id,site_id,source_event_id,event_type,channel,template_key,locale,payload,status,
                       read_at,acknowledged_at,delivered_at,created_at
                  FROM notification WHERE user_id=? ORDER BY created_at DESC LIMIT ?
                """,user.getId(),Math.max(1,Math.min(limit,200)));
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public ResponseEntity<Void> read(@AuthenticationPrincipal User user,@PathVariable UUID id){
        return jdbc.update("UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE id=? AND user_id=?",id,user.getId())==1
                ?ResponseEntity.noContent().build():ResponseEntity.notFound().build();
    }

    @PatchMapping("/{id}/acknowledge")
    @Transactional
    public ResponseEntity<Void> acknowledge(@AuthenticationPrincipal User user,@PathVariable UUID id){
        return jdbc.update("UPDATE notification SET acknowledged_at=COALESCE(acknowledged_at,now()),read_at=COALESCE(read_at,now()) WHERE id=? AND user_id=?",id,user.getId())==1
                ?ResponseEntity.noContent().build():ResponseEntity.notFound().build();
    }

    @GetMapping("/preferences")
    @Transactional(readOnly=true)
    public List<Map<String,Object>> preferences(@AuthenticationPrincipal User user){
        return jdbc.queryForList("SELECT id,site_id,event_type,channel,enabled,quiet_start,quiet_end,timezone FROM notification_preference WHERE user_id=? ORDER BY event_type,channel",user.getId());
    }

    @PutMapping("/preferences")
    @Transactional
    public ResponseEntity<Void> preference(@AuthenticationPrincipal User user,@Valid @RequestBody PreferenceRequest request){
        if(request.siteId()!=null) siteAccess.assertSiteAllowed(request.siteId());
        NotificationRecord.Channel.valueOf(request.channel());
        if((request.quietStart()==null)!=(request.quietEnd()==null))
            throw new IllegalArgumentException("quietStart and quietEnd must be supplied together");
        ZoneId.of(request.timezone());
        if(!Set.of("VehicleRelocated","VehicleExited","PersonProximity","CameraOffline").contains(request.eventType()))
            throw new IllegalArgumentException("Unsupported notification event type");
        jdbc.update("DELETE FROM notification_preference WHERE user_id=? AND event_type=? AND channel=? AND site_id IS NOT DISTINCT FROM ?",
                user.getId(),request.eventType(),request.channel(),request.siteId());
        jdbc.update("""
                INSERT INTO notification_preference(tenant_id,user_id,site_id,event_type,channel,enabled,quiet_start,quiet_end,timezone)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,TenantContext.getTenantId(),user.getId(),request.siteId(),request.eventType(),request.channel(),request.enabled(),
                request.quietStart()==null?null:Time.valueOf(request.quietStart()),request.quietEnd()==null?null:Time.valueOf(request.quietEnd()),request.timezone());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/deliveries")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @Transactional(readOnly=true)
    public List<Map<String,Object>> deliveries(@RequestParam(required=false) String status,@RequestParam(required=false) UUID siteId){
        if(siteId!=null) siteAccess.assertSiteAllowed(siteId); else siteAccess.assertAnyAssignedSite();
        List<UUID> sites=siteAccess.allowedSiteIds();
        StringBuilder sql=new StringBuilder("""
                SELECT n.id,n.site_id,n.user_id,n.event_type,n.channel,n.status,n.attempts,n.next_attempt_at,n.last_error,n.created_at
                  FROM notification n WHERE (? IS NULL OR n.status=?)
                """);
        List<Object> args=new ArrayList<>();
        args.add(status); args.add(status);
        if(siteId!=null){sql.append(" AND n.site_id=?");args.add(siteId);}
        else if(siteAccess.isRestricted()){
            if(sites.isEmpty()) return List.of();
            sql.append(" AND n.site_id IN (").append(String.join(",",Collections.nCopies(sites.size(),"?"))).append(")");args.addAll(sites);
        }
        sql.append(" ORDER BY n.created_at DESC LIMIT 200");
        return jdbc.queryForList(sql.toString(),args.toArray());
    }

    public record PreferenceRequest(UUID siteId,@NotBlank String eventType,@NotBlank String channel,boolean enabled,
                                    LocalTime quietStart,LocalTime quietEnd,@NotNull String timezone){}
}
