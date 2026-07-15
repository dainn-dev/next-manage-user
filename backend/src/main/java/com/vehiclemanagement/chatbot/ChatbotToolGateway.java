package com.vehiclemanagement.chatbot;

import com.vehiclemanagement.dto.*;
import com.vehiclemanagement.parking.*;
import com.vehiclemanagement.security.SiteAccess;
import com.vehiclemanagement.service.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Component @ConditionalOnProperty(name="chatbot.enabled",havingValue="true")
public class ChatbotToolGateway {
 private static final Set<String> ALLOWED=Set.of("getVehicleLocation","getHistory","getSnapshot","getParkingStatus");
 private final VehicleService vehicles;private final EventTimelineQueryService events;private final ParkingMapService map;
 private final SlotOccupancyService occupancy;private final SiteAccess siteAccess;private final SiteService sites;
 public ChatbotToolGateway(VehicleService vehicles,EventTimelineQueryService events,ParkingMapService map,SlotOccupancyService occupancy,SiteAccess siteAccess,SiteService sites){this.vehicles=vehicles;this.events=events;this.map=map;this.occupancy=occupancy;this.siteAccess=siteAccess;this.sites=sites;}

 public ToolResult execute(String tool,Map<String,String> proposedArguments,UUID selectedSite){
  if(!ALLOWED.contains(tool))throw new SecurityException("TOOL_NOT_ALLOWED");
  assertSite(selectedSite);
  String plate=requiresPlate(tool)?plate(proposedArguments.get("plate")):null;
  Map<String,Object> data=switch(tool){
   case "getVehicleLocation"->location(selectedSite,plate);
   case "getHistory"->history(selectedSite,plate,limit(proposedArguments.get("limit")));
   case "getSnapshot"->snapshot(selectedSite,plate);
   case "getParkingStatus"->parkingStatus(selectedSite);
   default->throw new SecurityException("TOOL_NOT_ALLOWED");
  };
  Map<String,Object> filtered=new LinkedHashMap<>();if(plate!=null)filtered.put("plate",mask(plate));filtered.put("siteId",selectedSite);
  return new ToolResult(tool,Map.copyOf(filtered),data,OffsetDateTime.now(ZoneOffset.UTC),"authoritative-api");
 }
 public void assertSite(UUID selectedSite){if(selectedSite==null)throw new IllegalArgumentException("siteId is required");siteAccess.assertSiteAllowed(selectedSite);sites.get(selectedSite);}

 private Map<String,Object> location(UUID site,String plate){
  PlateSearchResultDto row=exact(site,plate).orElse(null);if(row==null)return Map.of("found",false,"plate",plate);
  Map<String,Object> out=new LinkedHashMap<>();out.put("found",true);out.put("plate",row.licensePlateNumber());out.put("slotCode",row.currentSlotCode());
  out.put("slotId",row.currentSlotId());out.put("zoneId",row.currentZoneId());out.put("lastSeenAt",row.lastSeenAt());out.put("lastEventType",row.lastEventType());return out;
 }
 private Map<String,Object> history(UUID site,String plate,int limit){
  List<Map<String,Object>> rows=events.find(site,null,null,0,100).content().stream().filter(e->samePlate(e.plate(),plate)).limit(limit).map(e->{
   Map<String,Object> row=new LinkedHashMap<>();row.put("type",e.type());row.put("occurredAt",e.occurredAt());row.put("slotId",e.slotId());row.put("zoneId",e.zoneId());return row;
  }).toList();return Map.of("plate",plate,"events",rows,"count",rows.size());
 }
 private Map<String,Object> snapshot(UUID site,String plate){
  PlateSearchResultDto row=exact(site,plate).orElse(null);if(row==null||row.snapshotUrl()==null)return Map.of("found",false,"plate",plate);
  Map<String,Object> out=new LinkedHashMap<>();out.put("found",true);out.put("plate",row.licensePlateNumber());out.put("snapshotUrl",row.snapshotUrl());out.put("capturedAt",row.lastSeenAt());return out;
 }
 private Map<String,Object> parkingStatus(UUID site){
  int total=map.list(site).size();long occupied=occupancy.list(site,null).stream().filter(v->"occupied".equalsIgnoreCase(v.status())).count();
  return Map.of("siteId",site,"total",total,"occupied",occupied,"available",Math.max(0,total-occupied),"occupancyPercent",total==0?0:Math.round(occupied*1000.0/total)/10.0);
 }
 private Optional<PlateSearchResultDto> exact(UUID site,String plate){return vehicles.searchPlateAtSite(plate,site,20).stream().filter(v->samePlate(v.licensePlateNumber(),plate)).findFirst();}
 private static boolean requiresPlate(String tool){return !"getParkingStatus".equals(tool);}
 static String plate(String value){String p=value==null?"":value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]","");if(p.length()<4||p.length()>12)throw new IllegalArgumentException("Valid plate is required");return p;}
 private static boolean samePlate(String a,String b){return a!=null&&plate(a).equals(plate(b));}
 private static int limit(String value){try{return Math.min(20,Math.max(1,Integer.parseInt(value)));}catch(Exception ex){return 10;}}
 static String mask(String p){return p.length()<5?"***":p.substring(0,2)+"***"+p.substring(p.length()-2);}
 public record ToolResult(String tool,Map<String,Object> filteredArguments,Map<String,Object> data,OffsetDateTime freshAt,String source){}
}
