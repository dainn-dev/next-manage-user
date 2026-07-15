package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EventTimelinePageDto;
import com.vehiclemanagement.repository.EventTimelineReadRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Shared authoritative authorization boundary for dashboard and chatbot history reads. */
@Service
public class EventTimelineQueryService {
 private final EventTimelineReadRepository repository;private final SiteAccess siteAccess;
 public EventTimelineQueryService(EventTimelineReadRepository repository,SiteAccess siteAccess){this.repository=repository;this.siteAccess=siteAccess;}
 @Transactional(readOnly=true) public EventTimelinePageDto find(UUID siteId,UUID zoneId,String type,int page,int size){
  siteAccess.assertSiteAllowed(siteId);if(page<0||size<1||size>100)throw new IllegalArgumentException("page must be >= 0 and size must be between 1 and 100");
  return repository.find(siteId,zoneId,type,page,size);
 }
}
