ALTER TABLE camera
    ADD COLUMN stream_kind VARCHAR(20),
    ADD COLUMN stream_url VARCHAR(1000),
    ADD COLUMN stream_expires_at TIMESTAMP,
    ADD COLUMN snapshot_url VARCHAR(1000),
    ADD CONSTRAINT camera_stream_kind_check
        CHECK (stream_kind IS NULL OR stream_kind IN ('HLS', 'WEBRTC', 'MJPEG', 'MP4')),
    ADD CONSTRAINT camera_stream_pair_check
        CHECK ((stream_kind IS NULL) = (stream_url IS NULL));

COMMENT ON COLUMN camera.rtsp_url IS 'Edge-only source; never returned by dashboard APIs';
COMMENT ON COLUMN camera.stream_url IS 'Browser-safe gateway/proxy URL, preferably short-lived';
