-- Add avatar_url column to users table
-- Run this SQL command in your MySQL database

ALTER TABLE users 
ADD COLUMN avatar_url VARCHAR(255) NULL 
AFTER phone_number;

-- Verify the column was added
DESCRIBE users;
