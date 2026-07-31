-- Allow force-deleting a camera together with its parking-map commissioning
-- artifacts. parking_map_source_image and parking_map_activation_audit were
-- created (V78) with only SELECT/INSERT for the app roles, which blocks the
-- cascade teardown performed by CameraService.delete(force=true). RLS still
-- confines every deleted row to the current tenant.
GRANT DELETE ON parking_map_source_image, parking_map_activation_audit TO app_rls, app_admin;
