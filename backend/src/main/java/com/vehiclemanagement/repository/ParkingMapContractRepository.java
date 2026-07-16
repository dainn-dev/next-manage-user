package com.vehiclemanagement.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.parking.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Array;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.*;

@Repository
public class ParkingMapContractRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;
    public ParkingMapContractRepository(NamedParameterJdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}

    public boolean overviewCamera(UUID site,UUID camera){return Boolean.TRUE.equals(jdbc.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM camera WHERE id=:camera AND site_id=:site AND role='OVERVIEW')",p(site,camera),Boolean.class));}

    public ParkingMapSourceImageView saveImage(UUID id,UUID site,UUID camera,String key,String type,long size,
            String sha,int width,int height,UUID actor){
        jdbc.update("""
          INSERT INTO parking_map_source_image(id,site_id,camera_id,object_key,content_type,byte_size,
          sha256,native_width,native_height,capture_method,created_by) VALUES(:id,:site,:camera,:key,:type,:size,
          :sha,:width,:height,'upload',:actor)""",p(site,camera).addValue("id",id,Types.OTHER).addValue("key",key)
          .addValue("type",type).addValue("size",size).addValue("sha",sha).addValue("width",width)
          .addValue("height",height).addValue("actor",actor,Types.OTHER));
        return image(id,site,camera);
    }

    public ParkingMapSourceImageView image(UUID id,UUID site,UUID camera){return jdbc.queryForObject("""
      SELECT id,site_id,camera_id,content_type,byte_size,sha256,native_width,native_height,capture_method,
             created_at,object_key FROM parking_map_source_image WHERE id=:id AND site_id=:site AND camera_id=:camera
      """,p(site,camera).addValue("id",id,Types.OTHER),(rs,n)->new ParkingMapSourceImageView(rs.getObject("id",UUID.class),
      rs.getObject("site_id",UUID.class),rs.getObject("camera_id",UUID.class),rs.getString("content_type"),
      rs.getLong("byte_size"),rs.getString("sha256"),rs.getInt("native_width"),rs.getInt("native_height"),
      rs.getString("capture_method"),rs.getObject("created_at",OffsetDateTime.class),rs.getString("object_key")));
    }

    public List<ParkingMapSourceImageView> images(UUID site,UUID camera){return jdbc.query("""
      SELECT id,site_id,camera_id,content_type,byte_size,sha256,native_width,native_height,capture_method,
             created_at,object_key FROM parking_map_source_image WHERE site_id=:site AND camera_id=:camera
      ORDER BY created_at DESC,id
      """,p(site,camera),(rs,n)->new ParkingMapSourceImageView(rs.getObject("id",UUID.class),
      rs.getObject("site_id",UUID.class),rs.getObject("camera_id",UUID.class),rs.getString("content_type"),
      rs.getLong("byte_size"),rs.getString("sha256"),rs.getInt("native_width"),rs.getInt("native_height"),
      rs.getString("capture_method"),rs.getObject("created_at",OffsetDateTime.class),rs.getString("object_key")));}

    public CalibrationBinding calibration(UUID id,UUID site,UUID camera){return jdbc.queryForObject("""
      SELECT c.id,c.status,c.homography,c.source_image_id,i.native_width,i.native_height
        FROM camera_calibration_version c LEFT JOIN parking_map_source_image i ON i.id=c.source_image_id
       WHERE c.id=:id AND c.site_id=:site AND c.camera_id=:camera
      """,p(site,camera).addValue("id",id,Types.OTHER),(rs,n)->{
        Array a=rs.getArray("homography"); Double[] values=(Double[])a.getArray();
        return new CalibrationBinding(rs.getObject("id",UUID.class),rs.getString("status"),List.of(values),
          rs.getObject("source_image_id",UUID.class),(Integer)rs.getObject("native_width"),(Integer)rs.getObject("native_height"));
      });}

    public UUID createDraft(UUID site,UUID camera,UUID image,UUID calibration,List<ParkingMapPoint> coverage){
      UUID id=UUID.randomUUID(); Integer version=jdbc.queryForObject("SELECT COALESCE(max(version_number),0)+1 FROM site_map_version WHERE site_id=:site AND camera_id=:camera",p(site,camera),Integer.class);
      ParkingMapSourceImageView still=image(image,site,camera);
      jdbc.update("""
        INSERT INTO site_map_version(id,site_id,camera_id,version_number,status,coordinate_space,
        calibration_version,calibration_version_id,source_image_id,source_image_url,source_image_width,
        source_image_height,coverage_pixel_vertices) VALUES(:id,:site,:camera,:version,'draft','site-local-meters-v1',
        :calText,:calibration,:image,:url,:width,:height,CAST(:coverage AS jsonb))""",p(site,camera)
        .addValue("id",id,Types.OTHER).addValue("version",version).addValue("calText",calibration.toString())
        .addValue("calibration",calibration,Types.OTHER).addValue("image",image,Types.OTHER)
        .addValue("url",still.readUrl()).addValue("width",still.nativeWidth()).addValue("height",still.nativeHeight())
        .addValue("coverage",write(coverage)));
      return id;
    }

    public ParkingMapDraftView get(UUID map,UUID site,UUID camera){
      var head=jdbc.queryForMap("""
        SELECT id,site_id,camera_id,version_number,status,lock_version,source_image_id,
        calibration_version_id,coverage_pixel_vertices FROM site_map_version
        WHERE id=:map AND site_id=:site AND camera_id=:camera""",p(site,camera).addValue("map",map,Types.OTHER));
      List<ParkingMapDraftSlotRequest> slots=jdbc.query("""
        SELECT slot_id,zone_id,code,admin_status,pixel_vertices
        FROM parking_map_draft_slot WHERE map_version_id=:map ORDER BY lower(code),id""",
        new MapSqlParameterSource("map",map),(rs,n)->new ParkingMapDraftSlotRequest(rs.getObject("slot_id",UUID.class),
        rs.getObject("zone_id",UUID.class),rs.getString("code"),rs.getString("admin_status"),readPoints(rs.getString("pixel_vertices"))));
      return new ParkingMapDraftView((UUID)head.get("id"),(UUID)head.get("site_id"),(UUID)head.get("camera_id"),
        ((Number)head.get("version_number")).intValue(),(String)head.get("status"),((Number)head.get("lock_version")).intValue(),
        (UUID)head.get("source_image_id"),(UUID)head.get("calibration_version_id"),readPointsValue(head.get("coverage_pixel_vertices")),slots);
    }

    public List<ParkingMapDraftView> list(UUID site,UUID camera){
      return jdbc.query("SELECT id FROM site_map_version WHERE site_id=:site AND camera_id=:camera ORDER BY version_number DESC",
        p(site,camera),(rs,n)->get(rs.getObject(1,UUID.class),site,camera));
    }

    public void replaceDraft(UUID map,UUID site,UUID camera,int expected,List<ParkingMapPoint> coverage,List<ParkingMapDraftSlotRequest> slots){
      int changed=jdbc.update("""
        UPDATE site_map_version SET coverage_pixel_vertices=CAST(:coverage AS jsonb),
        lock_version=lock_version+1 WHERE id=:map AND site_id=:site AND camera_id=:camera
        AND status='draft' AND lock_version=:expected""",p(site,camera).addValue("map",map,Types.OTHER)
        .addValue("coverage",write(coverage)).addValue("expected",expected));
      if(changed!=1)throw new ConflictException("Draft changed or is no longer editable");
      jdbc.update("DELETE FROM parking_map_draft_slot WHERE map_version_id=:map",new MapSqlParameterSource("map",map));
      for(var slot:slots)jdbc.update("""
        INSERT INTO parking_map_draft_slot(site_id,camera_id,map_version_id,slot_id,zone_id,
        code,admin_status,pixel_vertices) VALUES(:site,:camera,:map,:slot,:zone,:code,:status,CAST(:points AS jsonb))""",
        new MapSqlParameterSource().addValue("site",site,Types.OTHER).addValue("map",map,Types.OTHER)
        .addValue("camera",camera,Types.OTHER)
        .addValue("slot",slot.slotId(),Types.OTHER).addValue("zone",slot.zoneId(),Types.OTHER).addValue("code",slot.code())
        .addValue("status",slot.adminStatus()).addValue("points",write(slot.pixelVertices())));
    }

    public void deleteDraft(UUID map,UUID site,UUID camera,int expected){int n=jdbc.update("DELETE FROM site_map_version WHERE id=:map AND site_id=:site AND camera_id=:camera AND status='draft' AND lock_version=:expected",p(site,camera).addValue("map",map,Types.OTHER).addValue("expected",expected));if(n!=1)throw new ConflictException("Draft changed or is no longer editable");}
    public void archive(UUID map,UUID site,UUID camera,int expected,UUID actor){
      String priorStatus=jdbc.query("SELECT status FROM site_map_version WHERE id=:map AND site_id=:site AND camera_id=:camera AND lock_version=:expected FOR UPDATE",
        p(site,camera).addValue("map",map,Types.OTHER).addValue("expected",expected),rs->rs.next()?rs.getString(1):null);
      int n=jdbc.update("UPDATE site_map_version SET status='archived',archived_at=CURRENT_TIMESTAMP,archived_by=:actor,lock_version=lock_version+1 WHERE id=:map AND site_id=:site AND camera_id=:camera AND status IN ('draft','published') AND lock_version=:expected",
        p(site,camera).addValue("map",map,Types.OTHER).addValue("actor",actor,Types.OTHER).addValue("expected",expected));
      if(n!=1)throw new ConflictException("Map is already archived");
      if("published".equals(priorStatus))jdbc.update("UPDATE parking_slot SET admin_status='retired' WHERE site_id=:site AND authoring_camera_id=:camera",p(site,camera));
      jdbc.update("INSERT INTO parking_map_activation_audit(site_id,camera_id,map_version_id,action,actor_id) VALUES(:site,:camera,:map,'archive',:actor)",
        p(site,camera).addValue("map",map,Types.OTHER).addValue("actor",actor,Types.OTHER));
    }
    public boolean zoneAtSite(UUID zone,UUID site){return zone==null||Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM zone WHERE id=:zone AND site_id=:site)",new MapSqlParameterSource().addValue("zone",zone,Types.OTHER).addValue("site",site,Types.OTHER),Boolean.class));}
    public boolean slotAtCamera(UUID slot,UUID site,UUID camera){return slot==null||Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_slot WHERE id=:slot AND site_id=:site AND authoring_camera_id=:camera AND admin_status<>'retired')",p(site,camera).addValue("slot",slot,Types.OTHER),Boolean.class));}
    public boolean validPolygon(String wkt){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT ST_IsValid(g) AND ST_IsSimple(g) AND ST_Area(g)>=0.10 FROM (SELECT ST_GeomFromText(:wkt,0) g)x",new MapSqlParameterSource("wkt",wkt),Boolean.class));}
    public boolean overlaps(String a,String b){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT ST_Area(ST_Intersection(ST_GeomFromText(:a,0),ST_GeomFromText(:b,0)))>0.000001",new MapSqlParameterSource().addValue("a",a).addValue("b",b),Boolean.class));}
    public boolean contains(String coverage,String slot){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT ST_Covers(ST_GeomFromText(:coverage,0),ST_GeomFromText(:slot,0))",new MapSqlParameterSource().addValue("coverage",coverage).addValue("slot",slot),Boolean.class));}
    public boolean overlapsPublished(UUID site,UUID camera,String wkt){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_slot_geometry g JOIN site_map_version m ON m.id=g.map_version_id WHERE m.site_id=:site AND m.status='published' AND m.camera_id<>:camera AND ST_Area(ST_Intersection(g.polygon,ST_GeomFromText(:wkt,0)))>0.000001)",p(site,camera).addValue("wkt",wkt),Boolean.class));}
    public boolean coverageOverlapsPublished(UUID site,UUID camera,String wkt){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM site_map_version m WHERE m.site_id=:site AND m.status='published' AND m.camera_id<>:camera AND m.coverage_polygon IS NOT NULL AND ST_Area(ST_Intersection(m.coverage_polygon,ST_GeomFromText(:wkt,0)))>0.000001)",p(site,camera).addValue("wkt",wkt),Boolean.class));}
    public boolean codeUsedByOtherCamera(UUID site,UUID camera,String code){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_slot_geometry g JOIN site_map_version m ON m.id=g.map_version_id JOIN parking_slot s ON s.id=g.slot_id WHERE m.site_id=:site AND m.status='published' AND m.camera_id<>:camera AND lower(btrim(s.code))=lower(btrim(:code)))",p(site,camera).addValue("code",code),Boolean.class));}
    public UUID publishedByKey(UUID site,UUID camera,String key){return jdbc.query("SELECT id FROM site_map_version WHERE site_id=:site AND camera_id=:camera AND publish_idempotency_key=:key",p(site,camera).addValue("key",key),rs->rs.next()?rs.getObject(1,UUID.class):null);}

    public void publish(ParkingMapDraftView draft,List<String> polygons,String coverageWkt,UUID actor,String key){
      UUID previous=jdbc.query("SELECT id FROM site_map_version WHERE site_id=:site AND camera_id=:camera AND status='published' FOR UPDATE",p(draft.siteId(),draft.cameraId()),rs->rs.next()?rs.getObject(1,UUID.class):null);
      if(previous!=null)jdbc.update("UPDATE site_map_version SET status='archived',archived_at=CURRENT_TIMESTAMP,archived_by=:actor,lock_version=lock_version+1 WHERE id=:id",new MapSqlParameterSource().addValue("actor",actor,Types.OTHER).addValue("id",previous,Types.OTHER));
      List<UUID> resolvedSlots=new ArrayList<>();
      for(var s:draft.slots()){UUID slot=s.slotId()==null?existingSlot(draft.siteId(),draft.cameraId(),s.code()):s.slotId();resolvedSlots.add(slot==null?UUID.randomUUID():slot);}
      jdbc.update("UPDATE parking_slot SET admin_status='retired' WHERE site_id=:site AND authoring_camera_id=:camera",p(draft.siteId(),draft.cameraId()));
      for(int i=0;i<draft.slots().size();i++){var s=draft.slots().get(i);UUID slot=resolvedSlots.get(i);
        int saved=jdbc.update("""
          INSERT INTO parking_slot(id,site_id,zone_id,code,admin_status,authoring_camera_id) VALUES(:id,:site,:zone,:code,:status,:camera)
          ON CONFLICT(id) DO UPDATE SET zone_id=excluded.zone_id,code=excluded.code,admin_status=excluded.admin_status,
          authoring_camera_id=excluded.authoring_camera_id
          WHERE parking_slot.site_id=excluded.site_id AND parking_slot.authoring_camera_id=excluded.authoring_camera_id""",
          new MapSqlParameterSource().addValue("id",slot,Types.OTHER).addValue("site",draft.siteId(),Types.OTHER)
          .addValue("camera",draft.cameraId(),Types.OTHER).addValue("zone",s.zoneId(),Types.OTHER).addValue("code",s.code()).addValue("status",s.adminStatus()));
        if(saved!=1)throw new ConflictException("Logical slot belongs to another camera partition");
        jdbc.update("UPDATE parking_map_draft_slot SET slot_id=:slot WHERE map_version_id=:map AND code=:code",
          new MapSqlParameterSource().addValue("slot",slot,Types.OTHER).addValue("map",draft.id(),Types.OTHER).addValue("code",s.code()));
        jdbc.update("""
          INSERT INTO parking_slot_geometry(id,site_id,slot_id,map_version_id,polygon,source_camera_id,pixel_vertices)
          VALUES(:id,:site,:slot,:map,ST_GeomFromText(:wkt,0),:camera,CAST(:pixels AS jsonb))""",
          new MapSqlParameterSource().addValue("id",UUID.randomUUID(),Types.OTHER).addValue("site",draft.siteId(),Types.OTHER)
          .addValue("slot",slot,Types.OTHER).addValue("map",draft.id(),Types.OTHER).addValue("wkt",polygons.get(i))
          .addValue("camera",draft.cameraId(),Types.OTHER).addValue("pixels",write(s.pixelVertices())));
      }
      int n=jdbc.update("""
        UPDATE site_map_version SET status='published',published_at=CURRENT_TIMESTAMP,
        published_by=:actor,publish_idempotency_key=:key,coverage_polygon=ST_GeomFromText(:coverage,0)
        WHERE id=:id AND status='draft' AND lock_version=:lock""",new MapSqlParameterSource().addValue("actor",actor,Types.OTHER)
        .addValue("key",key).addValue("coverage",coverageWkt).addValue("id",draft.id(),Types.OTHER).addValue("lock",draft.lockVersion()));
      if(n!=1)throw new ConflictException("Draft changed before publish");
      jdbc.update("""
        INSERT INTO parking_map_activation_audit(site_id,camera_id,map_version_id,previous_map_version_id,
        action,actor_id) VALUES(:site,:camera,:map,:previous,'publish',:actor)""",p(draft.siteId(),draft.cameraId())
        .addValue("map",draft.id(),Types.OTHER).addValue("previous",previous,Types.OTHER).addValue("actor",actor,Types.OTHER));
    }

    public void rollback(ParkingMapDraftView target,int expected,UUID actor,String reason){
      UUID current=jdbc.query("SELECT id FROM site_map_version WHERE site_id=:site AND camera_id=:camera AND status='published' FOR UPDATE",p(target.siteId(),target.cameraId()),rs->rs.next()?rs.getObject(1,UUID.class):null);
      if(current!=null)jdbc.update("UPDATE site_map_version SET status='archived',archived_at=CURRENT_TIMESTAMP,archived_by=:actor,lock_version=lock_version+1 WHERE id=:id",
        new MapSqlParameterSource().addValue("actor",actor,Types.OTHER).addValue("id",current,Types.OTHER));
      jdbc.update("UPDATE parking_slot SET admin_status='retired' WHERE site_id=:site AND authoring_camera_id=:camera",p(target.siteId(),target.cameraId()));
      for(var slot:target.slots()){
        if(slot.slotId()==null)throw new ConflictException("Archived map has no stable logical slot identity");
        int restored=jdbc.update("UPDATE parking_slot SET zone_id=:zone,code=:code,admin_status=:status WHERE id=:slot AND site_id=:site AND authoring_camera_id=:camera",
          p(target.siteId(),target.cameraId()).addValue("slot",slot.slotId(),Types.OTHER).addValue("zone",slot.zoneId(),Types.OTHER).addValue("code",slot.code()).addValue("status",slot.adminStatus()));
        if(restored!=1)throw new ConflictException("Archived slot ownership is no longer compatible");
      }
      int activated=jdbc.update("UPDATE site_map_version SET status='published',published_at=CURRENT_TIMESTAMP,archived_at=NULL,archived_by=NULL,lock_version=lock_version+1 WHERE id=:map AND site_id=:site AND camera_id=:camera AND status='archived' AND lock_version=:expected",
        p(target.siteId(),target.cameraId()).addValue("map",target.id(),Types.OTHER).addValue("expected",expected));
      if(activated!=1)throw new ConflictException("Archived map changed or is not rollback-compatible");
      jdbc.update("INSERT INTO parking_map_activation_audit(site_id,camera_id,map_version_id,previous_map_version_id,action,reason,actor_id) VALUES(:site,:camera,:map,:previous,'rollback',:reason,:actor)",
        p(target.siteId(),target.cameraId()).addValue("map",target.id(),Types.OTHER).addValue("previous",current,Types.OTHER).addValue("reason",reason).addValue("actor",actor,Types.OTHER));
    }

    public ParkingMapUnifiedPreviewView unifiedPreview(UUID site){
      List<ParkingMapUnifiedPreviewView.Feature> features=jdbc.query("""
        SELECT s.id slot_id,s.code,s.zone_id,s.admin_status,m.camera_id,m.id map_id,ST_AsGeoJSON(g.polygon) geometry
          FROM site_map_version m JOIN parking_slot_geometry g ON g.map_version_id=m.id
          JOIN parking_slot s ON s.id=g.slot_id
         WHERE m.site_id=:site AND m.status='published' AND s.admin_status='enabled'
         ORDER BY lower(s.code),s.id
        """,new MapSqlParameterSource().addValue("site",site,Types.OTHER),(rs,n)->new ParkingMapUnifiedPreviewView.Feature(
          rs.getObject("slot_id",UUID.class),rs.getString("code"),rs.getObject("zone_id",UUID.class),rs.getString("admin_status"),
          rs.getObject("camera_id",UUID.class),rs.getObject("map_id",UUID.class),readGeoJsonPolygon(rs.getString("geometry"))));
      return new ParkingMapUnifiedPreviewView(site,"site-local-meters-v1",features);
    }

    private MapSqlParameterSource p(UUID site,UUID camera){return new MapSqlParameterSource().addValue("site",site,Types.OTHER).addValue("camera",camera,Types.OTHER);}
    private String write(Object v){try{return json.writeValueAsString(v==null?List.of():v);}catch(JsonProcessingException e){throw new IllegalArgumentException("Invalid map geometry",e);}}
    private List<ParkingMapPoint> readPoints(String value){try{return value==null?List.of():json.readValue(value,new TypeReference<>(){});}catch(JsonProcessingException e){throw new IllegalStateException("Stored map geometry is invalid",e);}}
    private List<ParkingMapPoint> readPointsValue(Object value){return value==null?List.of():readPoints(value.toString());}
    public record CalibrationBinding(UUID id,String status,List<Double> matrix,UUID sourceImageId,Integer width,Integer height){}
    private UUID existingSlot(UUID site,UUID camera,String code){return jdbc.query("SELECT id FROM parking_slot WHERE site_id=:site AND authoring_camera_id=:camera AND lower(btrim(code))=lower(btrim(:code)) AND admin_status<>'retired'",p(site,camera).addValue("code",code),rs->rs.next()?rs.getObject(1,UUID.class):null);}
    private List<ParkingMapPoint> readGeoJsonPolygon(String value){try{JsonNode ring=json.readTree(value).path("coordinates").path(0);List<ParkingMapPoint> points=new ArrayList<>();for(JsonNode pair:ring)points.add(new ParkingMapPoint(pair.path(0).asDouble(),pair.path(1).asDouble()));if(points.size()>1&&points.getFirst().equals(points.getLast()))points.removeLast();return List.copyOf(points);}catch(JsonProcessingException e){throw new IllegalStateException("Stored map geometry is invalid",e);}}
}
