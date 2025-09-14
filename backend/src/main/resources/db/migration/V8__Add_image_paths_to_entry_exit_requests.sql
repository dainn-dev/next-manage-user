-- Add image path columns to entry_exit_requests table
ALTER TABLE entry_exit_requests 
ADD COLUMN entry_image_path VARCHAR(500),
ADD COLUMN exit_image_path VARCHAR(500);

-- Add comments for documentation
COMMENT ON COLUMN entry_exit_requests.entry_image_path IS 'Path to the image file uploaded when vehicle enters';
COMMENT ON COLUMN entry_exit_requests.exit_image_path IS 'Path to the image file uploaded when vehicle exits';
