-- Idempotent camera source columns for RTSP vs HTTP (DroidCam) edge workers.
-- Some environments already received these via an earlier V87 apply that is not
-- present in this branch; IF NOT EXISTS keeps both paths safe.

ALTER TABLE camera
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(16);

ALTER TABLE camera
    ADD COLUMN IF NOT EXISTS source_url VARCHAR(500);

UPDATE camera
SET source_type = 'rtsp'
WHERE source_type IS NULL;

UPDATE camera
SET source_url = rtsp_url
WHERE source_url IS NULL
  AND rtsp_url IS NOT NULL
  AND rtsp_url <> '';

ALTER TABLE camera
    ALTER COLUMN source_type SET DEFAULT 'rtsp';

ALTER TABLE camera
    ALTER COLUMN source_type SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'camera_source_type_check'
    ) THEN
        ALTER TABLE camera
            ADD CONSTRAINT camera_source_type_check
            CHECK (source_type IN ('rtsp', 'http'));
    END IF;
END $$;

COMMENT ON COLUMN camera.source_type IS 'Edge source protocol: rtsp or http (DroidCam MJPEG)';
COMMENT ON COLUMN camera.source_url IS 'Edge camera source URL delivered to site agents';
