-- Update the check constraint to include the new 'completed' status
ALTER TABLE entry_exit_requests DROP CONSTRAINT IF EXISTS entry_exit_requests_status_check;

ALTER TABLE entry_exit_requests ADD CONSTRAINT entry_exit_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed'));
