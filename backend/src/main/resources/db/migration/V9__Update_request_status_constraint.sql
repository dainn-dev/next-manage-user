-- Update the check constraint to remove 'rejected' status
ALTER TABLE entry_exit_requests DROP CONSTRAINT IF EXISTS entry_exit_requests_status_check;

ALTER TABLE entry_exit_requests ADD CONSTRAINT entry_exit_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'completed'));
