ALTER TABLE camera
    ADD COLUMN source_type VARCHAR(16) NOT NULL DEFAULT 'rtsp',
    ADD COLUMN source_url VARCHAR(500);

UPDATE camera
SET source_url = rtsp_url
WHERE source_url IS NULL
  AND rtsp_url IS NOT NULL;

COMMENT ON COLUMN camera.source_type IS 'Edge source protocol: rtsp or http';
COMMENT ON COLUMN camera.source_url IS 'Edge-only camera source URL; never returned by dashboard APIs';
