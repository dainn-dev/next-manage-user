package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.CameraRtspProbeProperties;
import com.vehiclemanagement.dto.CameraProbeResult;
import com.vehiclemanagement.entity.Camera;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Soft RTSP reachability + stream metadata probe used when operators create/update cameras.
 * Prefers ffprobe when available; falls back to TCP + RTSP DESCRIBE/SDP parsing.
 */
@Service
public class RtspProbeService {

    private static final Logger log = LoggerFactory.getLogger(RtspProbeService.class);
    private static final Pattern FRAMESIZE = Pattern.compile(
            "a=framesize:\\S+\\s+(\\d+)-(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern X_DIMENSIONS = Pattern.compile(
            "a=x-dimensions:(\\d+),(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FRAMERATE = Pattern.compile(
            "a=framerate:([0-9.]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RTPMAP = Pattern.compile(
            "a=rtpmap:\\d+\\s+([A-Za-z0-9_-]+)/", Pattern.CASE_INSENSITIVE);
    private static final Pattern WWW_AUTH = Pattern.compile(
            "WWW-Authenticate:\\s*(Digest|Basic)([^\\r\\n]*)", Pattern.CASE_INSENSITIVE);

    private final CameraRtspProbeProperties properties;
    private final ObjectMapper objectMapper;

    public RtspProbeService(CameraRtspProbeProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public CameraProbeResult probe(String sourceUrl) {
        return probe(sourceUrl, null);
    }

    public CameraProbeResult probe(String sourceUrl, Camera.SourceType sourceType) {
        LocalDateTime probedAt = LocalDateTime.now();
        URI uri;
        try {
            uri = validateAndParse(sourceUrl, sourceType);
        } catch (IllegalArgumentException ex) {
            return CameraProbeResult.builder()
                    .reachable(false)
                    .tcpOpen(false)
                    .streamOk(false)
                    .errorCode("INVALID_URL")
                    .errorMessage(ex.getMessage())
                    .probedAt(probedAt)
                    .build();
        }

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if ("http".equals(scheme) || "https".equals(scheme)) {
            return probeHttp(uri, probedAt);
        }
        return probeRtsp(uri, probedAt);
    }

    URI validateAndParse(String sourceUrl) {
        return validateAndParse(sourceUrl, null);
    }

    URI validateAndParse(String sourceUrl, Camera.SourceType sourceType) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            throw new IllegalArgumentException("Source URL is required");
        }
        URI uri;
        try {
            uri = URI.create(sourceUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid source URL", ex);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        boolean rtsp = "rtsp".equals(scheme) || "rtsps".equals(scheme);
        boolean http = "http".equals(scheme) || "https".equals(scheme);
        if (sourceType == Camera.SourceType.http) {
            if (!http) {
                throw new IllegalArgumentException("HTTP source URL must use http:// or https://");
            }
        } else if (sourceType == Camera.SourceType.rtsp) {
            if (!rtsp) {
                throw new IllegalArgumentException("URL must use rtsp:// or rtsps://");
            }
        } else if (!rtsp && !http) {
            throw new IllegalArgumentException("URL must use rtsp://, rtsps://, http://, or https://");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Source URL must include a host");
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if ("169.254.169.254".equals(host) || "metadata.google.internal".equals(host)) {
            throw new IllegalArgumentException("Host is not allowed for camera probe");
        }
        return uri;
    }

    private CameraProbeResult probeRtsp(URI uri, LocalDateTime probedAt) {
        String host = uri.getHost();
        int port = uri.getPort() > 0 ? uri.getPort() : defaultPort(uri.getScheme());

        CameraProbeResult.CameraProbeResultBuilder base = CameraProbeResult.builder()
                .host(host)
                .port(port)
                .probedAt(probedAt);

        CameraProbeResult ffprobe = tryFfprobe(uri.toString(), host, port, probedAt);
        if (ffprobe != null) {
            return ffprobe;
        }

        return probeWithRtspDescribe(uri, host, port, probedAt, base);
    }

    private CameraProbeResult probeHttp(URI uri, LocalDateTime probedAt) {
        String host = uri.getHost();
        int port = uri.getPort() > 0 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
        int timeout = (int) Math.min(Integer.MAX_VALUE, Math.max(500L, properties.getTimeoutMs()));

        HttpURLConnection connection = null;
        try {
            URL url = uri.toURL();
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout((int) Math.min(timeout, Math.max(500L, properties.getConnectTimeoutMs())));
            connection.setReadTimeout(timeout);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", "VehicleManagementProbe/1.0");
            connection.setRequestProperty("Accept", "*/*");
            int status = connection.getResponseCode();
            String contentType = connection.getContentType();
            boolean ok = status >= 200 && status < 400;
            boolean looksLikeMedia = contentType != null && (
                    contentType.toLowerCase(Locale.ROOT).contains("multipart")
                            || contentType.toLowerCase(Locale.ROOT).contains("image")
                            || contentType.toLowerCase(Locale.ROOT).contains("octet-stream")
                            || contentType.toLowerCase(Locale.ROOT).contains("mjpeg"));
            return CameraProbeResult.builder()
                    .reachable(ok)
                    .tcpOpen(true)
                    .streamOk(ok && (looksLikeMedia || status == 200))
                    .host(host)
                    .port(port)
                    .codec(looksLikeMedia ? "MJPEG" : null)
                    .probeMethod("http-get")
                    .errorCode(ok ? null : "HTTP_" + status)
                    .errorMessage(ok ? null : "HTTP source trả về status " + status)
                    .probedAt(probedAt)
                    .build();
        } catch (IOException ex) {
            return CameraProbeResult.builder()
                    .reachable(false)
                    .tcpOpen(false)
                    .streamOk(false)
                    .host(host)
                    .port(port)
                    .probeMethod("http-get")
                    .errorCode("UNREACHABLE")
                    .errorMessage(shortMessage(ex))
                    .probedAt(probedAt)
                    .build();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private CameraProbeResult tryFfprobe(String rtspUrl, String host, int port, LocalDateTime probedAt) {
        String ffprobePath = properties.getFfprobePath();
        if (ffprobePath == null || ffprobePath.isBlank()) {
            return null;
        }

        long timeoutMs = Math.max(1000L, properties.getTimeoutMs());
        // FFmpeg RTSP socket timeout is microseconds. Prefer TCP so Docker/containers
        // do not try to bind ephemeral UDP RTP ports ("Cannot assign requested address").
        long timeoutMicros = timeoutMs * 1000L;
        // FFmpeg 4.x uses -stimeout; 5+ uses -timeout. Try both shapes.
        String[][] argVariants = {
                {
                        ffprobePath, "-v", "error",
                        "-rtsp_transport", "tcp", "-rtsp_flags", "prefer_tcp",
                        "-select_streams", "v:0",
                        "-show_entries", "stream=codec_name,width,height,avg_frame_rate,r_frame_rate",
                        "-of", "json", "-stimeout", String.valueOf(timeoutMicros), rtspUrl
                },
                {
                        ffprobePath, "-v", "error",
                        "-rtsp_transport", "tcp", "-rtsp_flags", "prefer_tcp",
                        "-select_streams", "v:0",
                        "-show_entries", "stream=codec_name,width,height,avg_frame_rate,r_frame_rate",
                        "-of", "json", "-timeout", String.valueOf(timeoutMicros), rtspUrl
                }
        };

        for (String[] args : argVariants) {
            try {
                CameraProbeResult result = runFfprobe(args, host, port, probedAt, timeoutMs);
                if (result != null) {
                    return result;
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return CameraProbeResult.builder()
                        .reachable(false)
                        .tcpOpen(false)
                        .streamOk(false)
                        .host(host)
                        .port(port)
                        .probeMethod("ffprobe")
                        .errorCode("INTERRUPTED")
                        .errorMessage("Probe interrupted")
                        .probedAt(probedAt)
                        .build();
            }
        }
        return null;
    }

    private CameraProbeResult runFfprobe(
            String[] args,
            String host,
            int port,
            LocalDateTime probedAt,
            long timeoutMs) throws InterruptedException {
        ProcessBuilder builder = new ProcessBuilder(args);
        builder.redirectErrorStream(true);
        try {
            Process process = builder.start();
            String output;
            try (InputStream in = process.getInputStream()) {
                output = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            boolean finished = process.waitFor(timeoutMs + 2000L, TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return CameraProbeResult.builder()
                        .reachable(false)
                        .tcpOpen(false)
                        .streamOk(false)
                        .host(host)
                        .port(port)
                        .probeMethod("ffprobe")
                        .errorCode("TIMEOUT")
                        .errorMessage("Hết thời gian chờ khi kiểm tra RTSP (ffprobe)")
                        .probedAt(probedAt)
                        .build();
            }
            int exit = process.exitValue();
            if (exit != 0) {
                log.debug("ffprobe failed for {} (exit {}): {}", host, exit, firstNonBlankLine(output));
                return null;
            }

            JsonNode root = objectMapper.readTree(output);
            JsonNode stream = root.path("streams").isArray() && root.path("streams").size() > 0
                    ? root.path("streams").get(0)
                    : null;
            if (stream == null || stream.isMissingNode()) {
                return null;
            }

            Double fps = parseFrameRate(stream.path("avg_frame_rate").asText(null));
            if (fps == null) {
                fps = parseFrameRate(stream.path("r_frame_rate").asText(null));
            }
            Integer width = stream.hasNonNull("width") ? stream.get("width").asInt() : null;
            Integer height = stream.hasNonNull("height") ? stream.get("height").asInt() : null;
            String codec = stream.hasNonNull("codec_name") ? stream.get("codec_name").asText() : null;

            return CameraProbeResult.builder()
                    .reachable(true)
                    .tcpOpen(true)
                    .streamOk(true)
                    .host(host)
                    .port(port)
                    .codec(normalizeCodec(codec))
                    .width(width)
                    .height(height)
                    .fps(fps)
                    .probeMethod("ffprobe")
                    .probedAt(probedAt)
                    .build();
        } catch (IOException ex) {
            log.debug("ffprobe unavailable ({}), trying next strategy", ex.toString());
            return null;
        } catch (InterruptedException ex) {
            throw ex;
        } catch (Exception ex) {
            log.debug("ffprobe parse failed: {}", ex.toString());
            return null;
        }
    }

    private CameraProbeResult probeWithRtspDescribe(
            URI uri,
            String host,
            int port,
            LocalDateTime probedAt,
            CameraProbeResult.CameraProbeResultBuilder base) {
        int connectTimeout = (int) Math.min(Integer.MAX_VALUE, Math.max(500L, properties.getConnectTimeoutMs()));
        int readTimeout = (int) Math.min(Integer.MAX_VALUE, Math.max(500L, properties.getTimeoutMs()));

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), connectTimeout);
            socket.setSoTimeout(readTimeout);
            base.tcpOpen(true);

            String requestUri = buildRequestUri(uri, host, port);
            String userInfo = uri.getRawUserInfo();
            String username = null;
            String password = null;
            if (userInfo != null && !userInfo.isBlank()) {
                int split = userInfo.indexOf(':');
                if (split >= 0) {
                    username = decodeUserInfo(userInfo.substring(0, split));
                    password = decodeUserInfo(userInfo.substring(split + 1));
                } else {
                    username = decodeUserInfo(userInfo);
                    password = "";
                }
            }

            RtspResponse options = exchange(socket, buildOptions(requestUri, null), readTimeout);
            String authHeader = null;
            if (options.status == 401 && username != null) {
                authHeader = buildAuthorization(options.raw, "OPTIONS", requestUri, username, password);
                options = exchange(socket, buildOptions(requestUri, authHeader), readTimeout);
            }

            RtspResponse describe = exchange(socket, buildDescribe(requestUri, authHeader), readTimeout);
            if (describe.status == 401 && username != null) {
                authHeader = buildAuthorization(describe.raw, "DESCRIBE", requestUri, username, password);
                describe = exchange(socket, buildDescribe(requestUri, authHeader), readTimeout);
            }

            if (describe.status < 200 || describe.status >= 300) {
                return base.reachable(false)
                        .streamOk(false)
                        .probeMethod("rtsp-describe")
                        .errorCode("RTSP_" + describe.status)
                        .errorMessage(describe.status == 401
                                ? "RTSP yêu cầu xác thực thất bại (sai user/password?)"
                                : "RTSP DESCRIBE trả về HTTP-like status " + describe.status)
                        .build();
            }

            SdpInfo sdp = parseSdp(describe.body);
            boolean hasVideo = sdp.codec != null || sdp.width != null;
            return base.reachable(true)
                    .streamOk(hasVideo || describe.body != null && !describe.body.isBlank())
                    .codec(sdp.codec)
                    .width(sdp.width)
                    .height(sdp.height)
                    .fps(sdp.fps)
                    .probeMethod("rtsp-describe")
                    .build();
        } catch (IOException ex) {
            return base.reachable(false)
                    .tcpOpen(false)
                    .streamOk(false)
                    .probeMethod("rtsp-describe")
                    .errorCode("UNREACHABLE")
                    .errorMessage(shortMessage(ex))
                    .build();
        }
    }

    private static String buildRequestUri(URI uri, String host, int port) {
        String path = uri.getRawPath();
        if (path == null || path.isBlank()) {
            path = "/";
        }
        String query = uri.getRawQuery();
        StringBuilder sb = new StringBuilder();
        sb.append(uri.getScheme()).append("://").append(host).append(':').append(port).append(path);
        if (query != null && !query.isBlank()) {
            sb.append('?').append(query);
        }
        return sb.toString();
    }

    private static String buildOptions(String requestUri, String authorization) {
        StringBuilder sb = new StringBuilder();
        sb.append("OPTIONS ").append(requestUri).append(" RTSP/1.0\r\n");
        sb.append("CSeq: 1\r\n");
        sb.append("User-Agent: VehicleManagementProbe/1.0\r\n");
        if (authorization != null) {
            sb.append("Authorization: ").append(authorization).append("\r\n");
        }
        sb.append("\r\n");
        return sb.toString();
    }

    private static String buildDescribe(String requestUri, String authorization) {
        StringBuilder sb = new StringBuilder();
        sb.append("DESCRIBE ").append(requestUri).append(" RTSP/1.0\r\n");
        sb.append("CSeq: 2\r\n");
        sb.append("Accept: application/sdp\r\n");
        sb.append("User-Agent: VehicleManagementProbe/1.0\r\n");
        if (authorization != null) {
            sb.append("Authorization: ").append(authorization).append("\r\n");
        }
        sb.append("\r\n");
        return sb.toString();
    }

    private RtspResponse exchange(Socket socket, String request, int readTimeoutMs) throws IOException {
        OutputStream out = socket.getOutputStream();
        out.write(request.getBytes(StandardCharsets.UTF_8));
        out.flush();

        socket.setSoTimeout(readTimeoutMs);
        InputStream in = socket.getInputStream();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[2048];
        long deadline = System.currentTimeMillis() + readTimeoutMs;
        String raw = null;
        while (System.currentTimeMillis() < deadline) {
            int n = in.read(chunk);
            if (n < 0) {
                break;
            }
            buffer.write(chunk, 0, n);
            raw = buffer.toString(StandardCharsets.UTF_8);
            if (raw.contains("\r\n\r\n")) {
                int headerEnd = raw.indexOf("\r\n\r\n");
                String headers = raw.substring(0, headerEnd);
                int contentLength = contentLengthOf(headers);
                String body = raw.substring(headerEnd + 4);
                if (contentLength <= 0 || body.length() >= contentLength) {
                    break;
                }
            }
        }
        if (raw == null) {
            raw = buffer.toString(StandardCharsets.UTF_8);
        }
        return parseResponse(raw);
    }

    private static int contentLengthOf(String headers) {
        for (String line : headers.split("\r\n")) {
            if (line.regionMatches(true, 0, "Content-Length:", 0, 15)) {
                try {
                    return Integer.parseInt(line.substring(15).trim());
                } catch (NumberFormatException ignored) {
                    return 0;
                }
            }
        }
        return 0;
    }

    private static RtspResponse parseResponse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new RtspResponse(0, "", "");
        }
        int headerEnd = raw.indexOf("\r\n\r\n");
        String headerPart = headerEnd >= 0 ? raw.substring(0, headerEnd) : raw;
        String body = headerEnd >= 0 ? raw.substring(headerEnd + 4) : "";
        String firstLine = headerPart.lines().findFirst().orElse("");
        int status = 0;
        String[] parts = firstLine.split("\\s+");
        if (parts.length >= 2) {
            try {
                status = Integer.parseInt(parts[1]);
            } catch (NumberFormatException ignored) {
                status = 0;
            }
        }
        return new RtspResponse(status, headerPart, body);
    }

    private String buildAuthorization(
            String responseHeaders,
            String method,
            String uri,
            String username,
            String password) {
        Matcher matcher = WWW_AUTH.matcher(responseHeaders);
        if (!matcher.find()) {
            return "Basic " + Base64.getEncoder().encodeToString(
                    (username + ":" + (password == null ? "" : password)).getBytes(StandardCharsets.UTF_8));
        }
        String type = matcher.group(1);
        String params = matcher.group(2) == null ? "" : matcher.group(2);
        if ("Basic".equalsIgnoreCase(type)) {
            return "Basic " + Base64.getEncoder().encodeToString(
                    (username + ":" + (password == null ? "" : password)).getBytes(StandardCharsets.UTF_8));
        }
        String realm = headerParam(params, "realm");
        String nonce = headerParam(params, "nonce");
        String qop = headerParam(params, "qop");
        String opaque = headerParam(params, "opaque");
        String algorithm = headerParam(params, "algorithm");
        if (realm == null || nonce == null) {
            return null;
        }
        String ha1 = md5Hex(username + ":" + realm + ":" + (password == null ? "" : password));
        String ha2 = md5Hex(method + ":" + uri);
        String response;
        StringBuilder auth = new StringBuilder();
        auth.append("Digest username=\"").append(username).append("\", realm=\"").append(realm)
                .append("\", nonce=\"").append(nonce).append("\", uri=\"").append(uri).append("\"");
        if (qop != null && qop.toLowerCase(Locale.ROOT).contains("auth")) {
            String cnonce = String.format("%08x", (int) (Math.random() * 0xffffffffL));
            String nc = "00000001";
            response = md5Hex(ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":auth:" + ha2);
            auth.append(", qop=auth, nc=").append(nc).append(", cnonce=\"").append(cnonce).append("\"");
        } else {
            response = md5Hex(ha1 + ":" + nonce + ":" + ha2);
        }
        auth.append(", response=\"").append(response).append("\"");
        if (opaque != null) {
            auth.append(", opaque=\"").append(opaque).append("\"");
        }
        if (algorithm != null) {
            auth.append(", algorithm=").append(algorithm);
        }
        return auth.toString();
    }

    static SdpInfo parseSdp(String sdp) {
        SdpInfo info = new SdpInfo();
        if (sdp == null || sdp.isBlank()) {
            return info;
        }
        Matcher codecMatcher = RTPMAP.matcher(sdp);
        if (codecMatcher.find()) {
            info.codec = normalizeCodec(codecMatcher.group(1));
        }
        Matcher sizeMatcher = FRAMESIZE.matcher(sdp);
        if (sizeMatcher.find()) {
            info.width = Integer.parseInt(sizeMatcher.group(1));
            info.height = Integer.parseInt(sizeMatcher.group(2));
        } else {
            Matcher dimMatcher = X_DIMENSIONS.matcher(sdp);
            if (dimMatcher.find()) {
                info.width = Integer.parseInt(dimMatcher.group(1));
                info.height = Integer.parseInt(dimMatcher.group(2));
            }
        }
        Matcher fpsMatcher = FRAMERATE.matcher(sdp);
        if (fpsMatcher.find()) {
            try {
                info.fps = Double.parseDouble(fpsMatcher.group(1));
            } catch (NumberFormatException ignored) {
                // leave null
            }
        }
        return info;
    }

    static Double parseFrameRate(String value) {
        if (value == null || value.isBlank() || "0/0".equals(value)) {
            return null;
        }
        if (value.contains("/")) {
            String[] parts = value.split("/");
            if (parts.length != 2) {
                return null;
            }
            try {
                double num = Double.parseDouble(parts[0]);
                double den = Double.parseDouble(parts[1]);
                if (den == 0) {
                    return null;
                }
                return Math.round((num / den) * 100.0) / 100.0;
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    static String normalizeCodec(String codec) {
        if (codec == null || codec.isBlank()) {
            return null;
        }
        String value = codec.trim();
        if ("h264".equalsIgnoreCase(value) || "avc1".equalsIgnoreCase(value)) {
            return "H.264";
        }
        if ("hevc".equalsIgnoreCase(value) || "h265".equalsIgnoreCase(value)) {
            return "H.265";
        }
        if ("mjpeg".equalsIgnoreCase(value) || "jpeg".equalsIgnoreCase(value)) {
            return "MJPEG";
        }
        return value.toUpperCase(Locale.ROOT);
    }

    private static int defaultPort(String scheme) {
        return "rtsps".equalsIgnoreCase(scheme) ? 322 : 554;
    }

    private static String decodeUserInfo(String value) {
        return java.net.URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String md5Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("MD5 not available", ex);
        }
    }

    private static String headerParam(String params, String name) {
        Pattern pattern = Pattern.compile(
                name + "\\s*=\\s*(\"([^\"]*)\"|([^,\\s]+))", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(params);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(2) != null ? matcher.group(2) : matcher.group(3);
    }

    private static String firstNonBlankLine(String output) {
        if (output == null) {
            return null;
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new java.io.ByteArrayInputStream(output.getBytes(StandardCharsets.UTF_8)),
                StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    return line.trim();
                }
            }
        } catch (IOException ignored) {
            // ignore
        }
        return output.trim();
    }

    private static String shortMessage(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return ex.getClass().getSimpleName();
        }
        return message.length() > 180 ? message.substring(0, 180) + "…" : message;
    }

    private record RtspResponse(int status, String raw, String body) {
    }

    static final class SdpInfo {
        String codec;
        Integer width;
        Integer height;
        Double fps;
    }
}
