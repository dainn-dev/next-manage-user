package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.TenantVehicleRegistration;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.repository.TenantVehicleRegistrationRepository;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleAccessRequestRepository;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import com.vehiclemanagement.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.RestTemplateXhrTransport;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.Transport;

import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 4.5 end-to-end test of the core gate flow against a real Postgres:
 *
 * <pre>
 *   edge POST /api/vehicles/check-vehicle (gateId + X-Gate-Key)
 *        -> VehicleService.checkVehicleAccess()  (mutates vehicle, writes VehicleLog)
 *        -> WebSocketService push to /topic/vehicle-check AND /topic/gate/{id}/check
 *        -> kiosk (here: a real STOMP client) receives it
 *   replay via GET /api/gates/{id}/recent-checks?since=
 * </pre>
 *
 * Every assertion is made through the public HTTP + WebSocket surface and the
 * persisted database, not mocks, so the wiring of controller, service, security
 * filter, JPA and the STOMP broker is all exercised together.
 */
class CheckVehicleFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    VehicleRepository vehicleRepository;

    @Autowired
    TenantVehicleRegistrationRepository tenantVehicleRegistrationRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    VehicleLogRepository vehicleLogRepository;

    @Autowired
    VehicleAccessRequestRepository accessRequestRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    JwtUtil jwtUtil;

    // ---------------------------------------------------------------- helpers

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders gateHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Gate-Key", GATE_API_KEY);
        return headers;
    }

    /** Register (upsert) a gate through the edge endpoint and return its id. */
    private UUID registerGate(String name, String location) {
        Map<String, Object> body = Map.of("name", name, "location", location);
        ResponseEntity<Map> resp = rest.postForEntity(
                url("/api/gates/register"), new HttpEntity<>(body, gateHeaders()), Map.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        return UUID.fromString((String) resp.getBody().get("id"));
    }

    /** Persist an approved vehicle (with owning user) straight into the DB. */
    private Vehicle persistApprovedVehicle(String plate) {
        User user = userRepository.save(User.builder()
                .username("vehicle-owner-" + UUID.randomUUID())
                .email("vehicle-owner-" + UUID.randomUUID() + "@example.com")
                .password("test-password")
                .role(User.Role.TENANT_ADMIN)
                .status(User.UserStatus.ACTIVE)
                .build());
        Vehicle saved = vehicleRepository.save(Vehicle.builder()
                .owner(user)
                .licensePlate(plate)
                .vehicleType(Vehicle.VehicleType.car)
                .registrationDate(LocalDate.now())
                .status(Vehicle.VehicleStatus.approved)
                .build());
        // ADR-0604: gate whitelist is tenant_vehicle_registration
        UUID tenantId = saved.getTenantId() != null
                ? saved.getTenantId()
                : TenantContext.DEFAULT_TENANT_ID;
        tenantVehicleRegistrationRepository.save(TenantVehicleRegistration.builder()
                .id(new TenantVehicleRegistration.TenantVehicleRegistrationId(saved.getId(), tenantId))
                .status(TenantVehicleRegistration.Status.ACTIVE)
                .build());
        return saved;
    }

    private StompSession connectStomp() throws Exception {
        // XHR transport only: SockJS over plain HTTP, so the test needs no jakarta
        // websocket client implementation on the classpath (the app runs on Jetty).
        List<Transport> transports = List.of(new RestTemplateXhrTransport());
        WebSocketStompClient stompClient = new WebSocketStompClient(new SockJsClient(transports));
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        return stompClient
                .connectAsync(url("/ws"), new StompSessionHandlerAdapter() {})
                .get(10, TimeUnit.SECONDS);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private BlockingQueue<Map<String, Object>> subscribe(StompSession session, String destination) {
        BlockingQueue<Map<String, Object>> queue = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                queue.add((Map<String, Object>) payload);
            }
        });
        return queue;
    }

    /**
     * Token for tenant-scoped gate APIs ({@code TENANT_ADMIN}/{@code SITE_MANAGER}).
     * Demo {@code admin} is PLATFORM_ADMIN and cannot call those endpoints.
     */
    private String tenantAdminToken() {
        String username = "gate-ta-" + UUID.randomUUID();
        User tenantAdmin = userRepository.save(User.builder()
                .username(username)
                .email(username + "@example.com")
                .password(passwordEncoder.encode("SecurePass123!"))
                .role(User.Role.TENANT_ADMIN)
                .status(User.UserStatus.ACTIVE)
                .build());
        return jwtUtil.generateToken(tenantAdmin, Map.of(
                "role", User.Role.TENANT_ADMIN.name(),
                "email", tenantAdmin.getEmail(),
                "tenant_id", TenantContext.DEFAULT_TENANT_ID.toString()));
    }

    // ------------------------------------------------------------------ tests

    @Test
    void checkVehicle_persistsLog_andPushesToGlobalAndPerGateTopics() throws Exception {
        String plate = "51F-" + (System.nanoTime() % 100000);
        UUID gateId = registerGate("IT Gate A " + UUID.randomUUID(), "Khu A");
        persistApprovedVehicle(plate);

        StompSession session = connectStomp();
        BlockingQueue<Map<String, Object>> globalMsgs = subscribe(session, "/topic/vehicle-check");
        BlockingQueue<Map<String, Object>> gateMsgs =
                subscribe(session, "/topic/gate/" + gateId + "/check");
        // Give the SimpleBroker a moment to register the SUBSCRIBE frames before we
        // trigger the publish (SUBSCRIBE is processed asynchronously on the broker).
        Thread.sleep(700);

        Map<String, Object> checkBody = Map.of(
                "licensePlateNumber", plate,
                "type", "entry",
                "gateId", gateId.toString());
        ResponseEntity<Map> checkResp = rest.postForEntity(
                url("/api/vehicles/check-vehicle"), new HttpEntity<>(checkBody, gateHeaders()), Map.class);

        // 1) The gate is allowed in.
        assertThat(checkResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(checkResp.getBody()).isNotNull();
        assertThat(checkResp.getBody().get("approved")).isEqualTo(Boolean.TRUE);

        // 2) The event fans out to BOTH the global and the per-gate topic.
        Map<String, Object> globalEvent = globalMsgs.poll(5, TimeUnit.SECONDS);
        Map<String, Object> gateEvent = gateMsgs.poll(5, TimeUnit.SECONDS);
        assertThat(globalEvent).as("global topic message").isNotNull();
        assertThat(gateEvent).as("per-gate topic message").isNotNull();
        assertThat(gateEvent.get("licensePlateNumber")).isEqualTo(plate);
        assertThat(gateEvent.get("gateId")).isEqualTo(gateId.toString());

        // 3) A VehicleLog was written, tagged with the originating gate.
        session.disconnect();
        List<com.vehiclemanagement.entity.VehicleLog> logs =
                vehicleLogRepository.findByGateSince(gateId, LocalDateTime.now().minusMinutes(5));
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).getLicensePlateNumber()).isEqualTo(plate);
        assertThat(logs.get(0).getType()).isEqualTo(com.vehiclemanagement.entity.VehicleLog.LogType.entry);
    }

    @Test
    void checkVehicle_withMissingOrWrongGateKey_isRejected() throws Exception {
        String plate = "51G-" + (System.nanoTime() % 100000);
        String json = "{\"licensePlateNumber\":\"" + plate + "\",\"type\":\"entry\"}";

        // The JDK HttpClient is used here (not TestRestTemplate): the filter's 401
        // carries no WWW-Authenticate header, which Jetty's client treats as a
        // protocol violation and HttpURLConnection turns into an auth-retry error.
        HttpClient client = HttpClient.newHttpClient();

        // Missing X-Gate-Key -> 401.
        HttpResponse<String> missing = client.send(
                HttpRequest.newBuilder(URI.create(url("/api/vehicles/check-vehicle")))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(missing.statusCode()).isEqualTo(401);

        // Wrong X-Gate-Key -> 401.
        HttpResponse<String> wrong = client.send(
                HttpRequest.newBuilder(URI.create(url("/api/vehicles/check-vehicle")))
                        .header("Content-Type", "application/json")
                        .header("X-Gate-Key", "not-the-real-key")
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(wrong.statusCode()).isEqualTo(401);
    }

    @Test
    void recentChecks_replaysMissedEventsForTheGate() {
        String plate = "51H-" + (System.nanoTime() % 100000);
        UUID gateId = registerGate("IT Gate B " + UUID.randomUUID(), "Khu B");
        persistApprovedVehicle(plate);

        LocalDateTime beforeCheck = LocalDateTime.now().minusSeconds(5);

        Map<String, Object> checkBody = Map.of(
                "licensePlateNumber", plate,
                "type", "entry",
                "gateId", gateId.toString());
        ResponseEntity<Map> checkResp = rest.postForEntity(
                url("/api/vehicles/check-vehicle"), new HttpEntity<>(checkBody, gateHeaders()), Map.class);
        assertThat(checkResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.setBearerAuth(tenantAdminToken());
        HttpEntity<Void> authEntity = new HttpEntity<>(authHeaders);
        DateTimeFormatter iso = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

        // Replaying from before the check surfaces the missed event.
        ResponseEntity<List<Map<String, Object>>> replay = rest.exchange(
                url("/api/gates/" + gateId + "/recent-checks?since=" + iso.format(beforeCheck)),
                HttpMethod.GET, authEntity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {});
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(replay.getBody()).isNotNull();
        assertThat(replay.getBody())
                .as("missed check is replayed")
                .anySatisfy(log -> assertThat(log.get("licensePlateNumber")).isEqualTo(plate));

        // Replaying from the future returns nothing (no false positives).
        ResponseEntity<List<Map<String, Object>>> future = rest.exchange(
                url("/api/gates/" + gateId + "/recent-checks?since="
                        + iso.format(LocalDateTime.now().plusMinutes(10))),
                HttpMethod.GET, authEntity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {});
        assertThat(future.getBody()).noneSatisfy(
                log -> assertThat(log.get("licensePlateNumber")).isEqualTo(plate));
    }

    @Test
    void unregisteredPlate_raisesPendingAccessRequest_andTellsKioskToWait() throws Exception {
        String plate = "99Z-" + (System.nanoTime() % 100000);
        UUID gateId = registerGate("IT Gate C " + UUID.randomUUID(), "Khu C");

        StompSession session = connectStomp();
        BlockingQueue<Map<String, Object>> gateMsgs =
                subscribe(session, "/topic/gate/" + gateId + "/check");
        Thread.sleep(700);

        Map<String, Object> checkBody = Map.of(
                "licensePlateNumber", plate,
                "type", "entry",
                "gateId", gateId.toString());
        ResponseEntity<Map> checkResp = rest.postForEntity(
                url("/api/vehicles/check-vehicle"), new HttpEntity<>(checkBody, gateHeaders()), Map.class);

        // The gate does NOT open: the outcome is pending approval, not approved.
        assertThat(checkResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(checkResp.getBody()).isNotNull();
        assertThat(checkResp.getBody().get("approved")).isEqualTo(Boolean.FALSE);
        assertThat(String.valueOf(checkResp.getBody().get("result"))).isEqualTo("PENDING");

        // The kiosk is told, via the explicit status flag, to show an awaiting state.
        Map<String, Object> gateEvent = gateMsgs.poll(5, TimeUnit.SECONDS);
        session.disconnect();
        assertThat(gateEvent).as("per-gate pending message").isNotNull();
        assertThat(gateEvent.get("status")).isEqualTo("pending");

        // A GATE-sourced PENDING access request lands in the approval queue.
        List<VehicleAccessRequest> pending = accessRequestRepository
                .findByStatus(VehicleAccessRequest.AccessRequestStatus.PENDING);
        assertThat(pending)
                .as("a pending gate access request was raised for the unknown plate")
                .anySatisfy(request -> {
                    assertThat(request.getLicensePlate()).isEqualTo(plate);
                    assertThat(request.getSource()).isEqualTo(VehicleAccessRequest.RequestSource.GATE);
                    assertThat(request.getGate()).isNotNull();
                    assertThat(request.getGate().getId()).isEqualTo(gateId);
                });
    }
}
