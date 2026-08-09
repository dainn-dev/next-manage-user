package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.CameraRtspProbeProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RtspProbeServiceTest {

    private RtspProbeService service;

    @BeforeEach
    void setUp() {
        CameraRtspProbeProperties properties = new CameraRtspProbeProperties();
        properties.setFfprobePath(""); // force non-process path for unit tests
        service = new RtspProbeService(properties, new ObjectMapper());
    }

    @Test
    void rejectsNonRtspSchemesWhenRtspRequired() {
        assertThatThrownBy(() -> service.validateAndParse("http://192.168.0.1/stream",
                com.vehiclemanagement.entity.Camera.SourceType.rtsp))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("rtsp");
    }

    @Test
    void acceptsHttpWhenHttpSourceRequested() {
        var uri = service.validateAndParse("http://192.168.0.199:4747/video",
                com.vehiclemanagement.entity.Camera.SourceType.http);
        assertThat(uri.getHost()).isEqualTo("192.168.0.199");
        assertThat(uri.getPort()).isEqualTo(4747);
    }

    @Test
    void rejectsCloudMetadataHost() {
        assertThatThrownBy(() -> service.validateAndParse("rtsp://169.254.169.254/stream"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void parsesSdpVideoMetadata() {
        String sdp = """
                v=0
                m=video 0 RTP/AVP 96
                a=rtpmap:96 H264/90000
                a=framesize:96 1920-1080
                a=framerate:15.0
                """;

        RtspProbeService.SdpInfo info = RtspProbeService.parseSdp(sdp);

        assertThat(info.codec).isEqualTo("H.264");
        assertThat(info.width).isEqualTo(1920);
        assertThat(info.height).isEqualTo(1080);
        assertThat(info.fps).isEqualTo(15.0);
    }

    @Test
    void parsesFractionalFrameRate() {
        assertThat(RtspProbeService.parseFrameRate("15/1")).isEqualTo(15.0);
        assertThat(RtspProbeService.parseFrameRate("30000/1001")).isEqualTo(29.97);
        assertThat(RtspProbeService.parseFrameRate("0/0")).isNull();
    }

    @Test
    void unreachableHostReturnsDiagnosticResult() {
        var result = service.probe("rtsp://127.0.0.1:1/no-such-stream");

        assertThat(result.isReachable()).isFalse();
        assertThat(result.isTcpOpen()).isFalse();
        assertThat(result.getHost()).isEqualTo("127.0.0.1");
        assertThat(result.getPort()).isEqualTo(1);
        assertThat(result.getErrorCode()).isEqualTo("UNREACHABLE");
        assertThat(result.getProbeMethod()).isEqualTo("rtsp-describe");
    }
}
