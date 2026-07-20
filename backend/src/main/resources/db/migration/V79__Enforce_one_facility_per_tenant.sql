-- A tenant represents exactly one operating facility. Site remains an internal
-- compatibility table while API/domain callers are migrated to tenant scope,
-- but it is no longer a multi-branch resource.
--
-- Do not silently merge existing facilities: their cameras, zones and parking
-- sessions are operational records. A deliberate data migration is required
-- before enabling the single-facility model for a tenant with multiple sites.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM site
        GROUP BY tenant_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot enable the single-facility model while a tenant has multiple sites. Consolidate tenant data first.';
    END IF;
END $$;

ALTER TABLE site
    ADD CONSTRAINT uq_site_one_facility_per_tenant UNIQUE (tenant_id);

-- Per-user site membership has no meaning with one facility per tenant.
DROP TABLE IF EXISTS user_site;
