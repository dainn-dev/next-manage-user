-- DAI-262 follow-up: retain the newest applied Stripe event per subscription.
-- Existing migrations are immutable; this migration only extends their schema.

ALTER TABLE billing_subscription
    ADD COLUMN last_stripe_event_created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN last_stripe_event_id VARCHAR(255);

ALTER TABLE processed_stripe_event
    ADD COLUMN event_created_at TIMESTAMP WITH TIME ZONE;
