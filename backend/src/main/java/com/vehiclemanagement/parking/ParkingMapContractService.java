package com.vehiclemanagement.parking;

import com.fasterxml.jackson.databind.JsonNode;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingMapContractRepository;
import com.vehiclemanagement.security.SiteAccess;
import com.vehiclemanagement.service.ObjectStorageService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ParkingMapContractService {
  private static final long MAX_IMAGE_BYTES = 15L * 1024 * 1024;
  private final ParkingMapContractRepository repo;
  private final ObjectStorageService storage;
  private final HomographyCalibrationService homography;
  private final SiteAccess access;

  public ParkingMapContractService(ParkingMapContractRepository repo, ObjectStorageService storage,
      HomographyCalibrationService homography, SiteAccess access) {
    this.repo = repo;
    this.storage = storage;
    this.homography = homography;
    this.access = access;
  }

  @Transactional
  public ParkingMapSourceImageView upload(UUID site, UUID camera, MultipartFile file) {
    requireCamera(site, camera);
    if (file == null || file.isEmpty())
      throw new IllegalArgumentException("Source image is required");
    if (file.getSize() > MAX_IMAGE_BYTES)
      throw new IllegalArgumentException("Source image must not exceed 15 MiB");
    String type = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase(Locale.ROOT);
    if (!Set.of("image/jpeg", "image/png", "image/webp").contains(type))
      throw new IllegalArgumentException("Source image must be JPEG, PNG, or WebP");
    try {
      byte[] bytes = file.getBytes();
      BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
      if (image == null)
        throw new IllegalArgumentException("Source image cannot be decoded");
      if (image.getWidth() > 16384 || image.getHeight() > 16384)
        throw new IllegalArgumentException("Source image dimensions exceed 16384x16384");
      UUID tenant = TenantContext.getTenantId();
      if (tenant == null)
        throw new IllegalStateException("Tenant context is required");
      UUID id = UUID.randomUUID();
      String key = storage.storeParkingMapStill(tenant, camera, id, bytes, type);
      var saved = repo.saveImage(id, site, camera, key, type, bytes.length,
          hex(MessageDigest.getInstance("SHA-256").digest(bytes)), image.getWidth(), image.getHeight(), actor());
      return resolve(saved);
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException("Unable to store source image", e);
    }
  }

  @Transactional(readOnly = true)
  public ParkingMapSourceImageView image(UUID site, UUID camera, UUID id) {
    requireCamera(site, camera);
    return resolve(repo.image(id, site, camera));
  }

  @Transactional(readOnly = true)
  public List<ParkingMapSourceImageView> images(UUID site, UUID camera) {
    requireCamera(site, camera);
    return repo.images(site, camera).stream().map(this::resolve).toList();
  }

  @Transactional
  public ParkingMapDraftView create(UUID site, UUID camera, ParkingMapDraftRequest request) {
    requireCamera(site, camera);
    if (request == null || request.sourceImageId() == null || request.calibrationVersionId() == null)
      throw new IllegalArgumentException("Source image and calibration are required");
    var image = repo.image(request.sourceImageId(), site, camera);
    var cal = repo.calibration(request.calibrationVersionId(), site, camera);
    if (!"valid".equals(cal.status()))
      throw new IllegalArgumentException("Calibration must be valid");
    if (!image.id().equals(cal.sourceImageId()))
      throw new IllegalArgumentException("Calibration must be bound to the exact source image");
    List<ParkingMapPoint> coverage = coverage(request.coveragePixelVertices(), image.nativeWidth(),
        image.nativeHeight());
    List<ParkingMapDraftSlotRequest> slots = normalize(request.slots(), site, camera, image.nativeWidth(),
        image.nativeHeight());
    UUID id = repo.createDraft(site, camera, image.id(), cal.id(), coverage);
    repo.replaceDraft(id, site, camera, 0, coverage, slots);
    return repo.get(id, site, camera);
  }

  @Transactional
  public ParkingMapDraftView update(UUID site, UUID camera, UUID map, int expected, ParkingMapDraftRequest request) {
    requireCamera(site, camera);
    var current = repo.get(map, site, camera);
    if (!"draft".equals(current.status()))
      throw new ConflictException("Only drafts are editable");
    var image = repo.image(current.sourceImageId(), site, camera);
    List<ParkingMapPoint> coverage = coverage(request.coveragePixelVertices(), image.nativeWidth(),
        image.nativeHeight());
    repo.replaceDraft(map, site, camera, expected, coverage,
        normalize(request.slots(), site, camera, image.nativeWidth(), image.nativeHeight()));
    return repo.get(map, site, camera);
  }

  @Transactional(readOnly = true)
  public ParkingMapDraftView get(UUID site, UUID camera, UUID map) {
    requireCamera(site, camera);
    return repo.get(map, site, camera);
  }

  @Transactional(readOnly = true)
  public List<ParkingMapDraftView> list(UUID site, UUID camera) {
    requireCamera(site, camera);
    return repo.list(site, camera);
  }

  @Transactional
  public void delete(UUID site, UUID camera, UUID map, int expected) {
    requireCamera(site, camera);
    repo.deleteDraft(map, site, camera, expected);
  }

  @Transactional
  public void archive(UUID site, UUID camera, UUID map, int expected) {
    requireCamera(site, camera);
    repo.archive(map, site, camera, expected, actor());
  }

  @Transactional(readOnly = true)
  public ParkingMapValidationView validate(UUID site, UUID camera, UUID map) {
    requireCamera(site, camera);
    return validateCandidate(site, camera, map, false);
  }

  private ParkingMapValidationView validateCandidate(UUID site, UUID camera, UUID map, boolean rollback) {
    var draft = repo.get(map, site, camera);
    repo.image(draft.sourceImageId(), site, camera);
    var cal = repo.calibration(draft.calibrationVersionId(), site, camera);
    List<String> errors = new ArrayList<>();
    if (!(rollback ? "archived".equals(draft.status()) : "draft".equals(draft.status())))
      errors.add(rollback ? "Map is not an archived rollback candidate" : "Map is not an editable draft");
    if (!"valid".equals(cal.status()))
      errors.add("Calibration is missing, stale, or invalid");
    List<String> polygons = new ArrayList<>();
    Set<String> codes = new HashSet<>();
    String coverageWkt = toWkt(transform(cal.matrix(), draft.coveragePixelVertices()));
    if (!repo.validPolygon(coverageWkt))
      errors.add("Camera coverage polygon is invalid");
    if (repo.coverageOverlapsPublished(site, camera, coverageWkt))
      errors.add("Camera coverage overlaps another published partition");
    for (var slot : draft.slots()) {
      if (!codes.add(slot.code().trim().toLowerCase(Locale.ROOT)))
        errors.add("Duplicate slot code: " + slot.code());
      if (repo.codeUsedByOtherCamera(site, camera, slot.code()))
        errors.add("Slot code is already active in another camera partition: " + slot.code());
      String wkt = toWkt(transform(cal.matrix(), slot.pixelVertices()));
      polygons.add(wkt);
      if (!repo.validPolygon(wkt))
        errors.add("Slot " + slot.code() + " has invalid or too-small geometry");
      if (!repo.contains(coverageWkt, wkt))
        errors.add("Slot " + slot.code() + " lies outside its camera coverage partition");
      if (repo.overlapsPublished(site, camera, wkt))
        errors.add("Slot " + slot.code() + " overlaps another camera partition");
    }
    // Adjacent parking slots naturally share edges, so overlap checking between slots is disabled.
    // Overlap with other camera partitions is still validated above.
    return new ParkingMapValidationView(errors.isEmpty(), List.copyOf(errors));
  }

  @Transactional
  public ParkingMapDraftView publish(UUID site, UUID camera, UUID map, int expected, String idempotencyKey) {
    if (idempotencyKey == null || idempotencyKey.isBlank())
      throw new IllegalArgumentException("Idempotency-Key is required");
    requireCamera(site, camera);
    UUID prior = repo.publishedByKey(site, camera, idempotencyKey.trim());
    if (prior != null)
      return repo.get(prior, site, camera);
    var current = repo.get(map, site, camera);
    if (current.lockVersion() != expected)
      throw new ConflictException("Draft changed before publish");
    var validation = validate(site, camera, map);
    if (!validation.valid())
      throw new IllegalArgumentException(String.join("; ", validation.errors()));
    var draft = repo.get(map, site, camera);
    var cal = repo.calibration(draft.calibrationVersionId(), site, camera);
    List<String> polygons = draft.slots().stream().map(s -> toWkt(transform(cal.matrix(), s.pixelVertices()))).toList();
    String coverage = toWkt(transform(cal.matrix(), draft.coveragePixelVertices()));
    repo.publish(draft, polygons, coverage, actor(), idempotencyKey.trim());
    return repo.get(map, site, camera);
  }

  @Transactional
  public ParkingMapDraftView rollback(UUID site, UUID camera, UUID map, int expected, String reason) {
    requireCamera(site, camera);
    if (reason == null || reason.isBlank())
      throw new IllegalArgumentException("Rollback reason is required");
    var target = repo.get(map, site, camera);
    if (target.lockVersion() != expected)
      throw new ConflictException("Archived map changed before rollback");
    var validation = validateCandidate(site, camera, map, true);
    if (!validation.valid())
      throw new IllegalArgumentException(String.join("; ", validation.errors()));
    repo.rollback(target, expected, actor(), reason.trim());
    return repo.get(map, site, camera);
  }

  @Transactional(readOnly = true)
  public ParkingMapUnifiedPreviewView unifiedPreview(UUID site) {
    access.assertSiteAllowed(site);
    return repo.unifiedPreview(site);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> exportGeoJson(UUID site, UUID camera, UUID map) {
    requireCamera(site, camera);
    var draft = repo.get(map, site, camera);
    var cal = repo.calibration(draft.calibrationVersionId(), site, camera);
    List<Map<String, Object>> features = new ArrayList<>();
    for (var slot : draft.slots()) {
      List<ParkingMapPoint> points = new ArrayList<>(transform(cal.matrix(), slot.pixelVertices()));
      points.add(points.getFirst());
      List<List<Double>> ring = points.stream().map(p -> List.of(p.x(), p.y())).toList();
      features.add(Map.of("type", "Feature", "geometry", Map.of("type", "Polygon", "coordinates", List.of(ring)),
          "properties", mapProperties(slot, draft)));
    }
    return Map.of("type", "FeatureCollection", "coordinateSpace", "site-local-meters-v1", "features", features);
  }

  @Transactional
  public ParkingMapDraftView importGeoJson(UUID site, UUID camera, ParkingMapGeoJsonImportRequest request) {
    requireCamera(site, camera);
    if (request == null || request.geoJson() == null
        || !"FeatureCollection".equals(request.geoJson().path("type").asText()))
      throw new IllegalArgumentException("GeoJSON FeatureCollection is required");
    if (!"site-local-meters-v1".equals(request.geoJson().path("coordinateSpace").asText()))
      throw new IllegalArgumentException("GeoJSON coordinateSpace must be site-local-meters-v1");
    var cal = repo.calibration(request.calibrationVersionId(), site, camera);
    List<Double> inverse = invert(cal.matrix());
    List<ParkingMapDraftSlotRequest> slots = new ArrayList<>();
    for (JsonNode feature : request.geoJson().path("features")) {
      JsonNode geometry = feature.path("geometry"), coordinates = geometry.path("coordinates");
      if (!"Polygon".equals(geometry.path("type").asText()) || !coordinates.isArray() || coordinates.size() != 1)
        throw new IllegalArgumentException("GeoJSON features must be single-ring Polygon geometries");
      JsonNode properties = feature.path("properties"), ring = coordinates.path(0);
      if (!ring.isArray() || ring.size() < 4)
        throw new IllegalArgumentException("GeoJSON polygon requires at least three vertices");
      List<ParkingMapPoint> pixels = new ArrayList<>();
      for (JsonNode coordinate : ring) {
        if (!coordinate.isArray() || coordinate.size() < 2 || !coordinate.path(0).isNumber()
            || !coordinate.path(1).isNumber())
          throw new IllegalArgumentException("GeoJSON coordinates must be finite numbers");
        double x = coordinate.path(0).asDouble(), y = coordinate.path(1).asDouble();
        if (!Double.isFinite(x) || !Double.isFinite(y))
          throw new IllegalArgumentException("GeoJSON coordinates must be finite numbers");
        pixels.add(homography.transform(inverse, x, y));
      }
      if (pixels.size() > 1 && pixels.getFirst().equals(pixels.getLast()))
        pixels.removeLast();
      UUID zone = properties.path("zoneId").isTextual() ? UUID.fromString(properties.path("zoneId").asText()) : null;
      slots.add(new ParkingMapDraftSlotRequest(null, zone, properties.path("code").asText(),
          properties.path("adminStatus").asText("enabled"), pixels));
    }
    return create(site, camera,
        new ParkingMapDraftRequest(request.sourceImageId(), request.calibrationVersionId(), null, slots));
  }

  private List<ParkingMapDraftSlotRequest> normalize(List<ParkingMapDraftSlotRequest> input, UUID site, UUID camera,
      int width, int height) {
    List<ParkingMapDraftSlotRequest> out = new ArrayList<>();
    Set<String> codes = new HashSet<>();
    for (var slot : input == null ? List.<ParkingMapDraftSlotRequest>of() : input) {
      if (slot == null || slot.code() == null || slot.code().isBlank())
        throw new IllegalArgumentException("Slot code is required");
      String code = slot.code().trim();
      if (!codes.add(code.toLowerCase(Locale.ROOT)))
        throw new IllegalArgumentException("Slot codes must be unique");
      if (!repo.zoneAtSite(slot.zoneId(), site))
        throw new IllegalArgumentException("Zone does not belong to site");
      if (!repo.slotAtCamera(slot.slotId(), site, camera))
        throw new IllegalArgumentException("Slot does not belong to this camera partition");
      List<ParkingMapPoint> points = bounded(slot.pixelVertices(), width, height);
      out.add(
          new ParkingMapDraftSlotRequest(slot.slotId(), slot.zoneId(), code, normalStatus(slot.adminStatus()), points));
    }
    return List.copyOf(out);
  }

  private List<ParkingMapPoint> coverage(List<ParkingMapPoint> p, int w, int h) {
    return p == null || p.isEmpty() ? List.of(new ParkingMapPoint(0, 0), new ParkingMapPoint(w, 0),
        new ParkingMapPoint(w, h), new ParkingMapPoint(0, h)) : bounded(p, w, h);
  }

  private List<ParkingMapPoint> bounded(List<ParkingMapPoint> p, int w, int h) {
    if (p == null || p.size() < 3)
      throw new IllegalArgumentException("Polygon requires at least three vertices");
    for (var x : p)
      if (x == null || !Double.isFinite(x.x()) || !Double.isFinite(x.y()) || x.x() < 0 || x.y() < 0 || x.x() > w
          || x.y() > h)
        throw new IllegalArgumentException("Polygon vertex is outside native image bounds");
    return List.copyOf(p);
  }

  private List<ParkingMapPoint> transform(List<Double> matrix, List<ParkingMapPoint> pixels) {
    return pixels.stream().map(p -> homography.transform(matrix, p.x(), p.y())).toList();
  }

  private String toWkt(List<ParkingMapPoint> p) {
    StringJoiner j = new StringJoiner(",", "POLYGON((", "))");
    for (var x : p)
      j.add(x.x() + " " + x.y());
    j.add(p.getFirst().x() + " " + p.getFirst().y());
    return j.toString();
  }

  private String normalStatus(String s) {
    String v = s == null || s.isBlank() ? "enabled" : s.trim().toLowerCase(Locale.ROOT);
    // The commissioning UI uses operator-facing names while the runtime schema
    // keeps the original enabled/disabled/retired vocabulary.
    v = switch (v) {
      case "active" -> "enabled";
      case "reserved" -> "disabled";
      default -> v;
    };
    if (!Set.of("enabled", "disabled", "retired").contains(v))
      throw new IllegalArgumentException("Invalid slot status");
    return v;
  }

  private void requireCamera(UUID site, UUID camera) {
    access.assertSiteAllowed(site);
    if (!repo.overviewCamera(site, camera))
      throw new ResourceNotFoundException("Overview camera not found");
  }

  private UUID actor() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getPrincipal() instanceof User u ? u.getId() : null;
  }

  private ParkingMapSourceImageView resolve(ParkingMapSourceImageView x) {
    return new ParkingMapSourceImageView(x.id(), x.siteId(), x.cameraId(), x.contentType(), x.byteSize(), x.sha256(),
        x.nativeWidth(), x.nativeHeight(), x.captureMethod(), x.createdAt(), storage.resolveReadUrl(x.readUrl()));
  }

  private String hex(byte[] b) {
    return java.util.HexFormat.of().formatHex(b);
  }

  private Map<String, Object> mapProperties(ParkingMapDraftSlotRequest slot, ParkingMapDraftView map) {
    Map<String, Object> p = new LinkedHashMap<>();
    p.put("slotId", slot.slotId());
    p.put("code", slot.code());
    p.put("zoneId", slot.zoneId());
    p.put("adminStatus", slot.adminStatus());
    p.put("cameraId", map.cameraId());
    p.put("mapVersionId", map.id());
    return p;
  }

  private List<Double> invert(List<Double> h) {
    double a = h.get(0), b = h.get(1), c = h.get(2), d = h.get(3), e = h.get(4), f = h.get(5), g = h.get(6),
        i = h.get(7), j = h.get(8);
    double det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
    if (Math.abs(det) < 1e-10)
      throw new IllegalArgumentException("Calibration homography is not invertible");
    return List.of((e * j - f * i) / det, (c * i - b * j) / det, (b * f - c * e) / det, (f * g - d * j) / det,
        (a * j - c * g) / det, (c * d - a * f) / det, (d * i - e * g) / det, (b * g - a * i) / det,
        (a * e - b * d) / det);
  }
}
