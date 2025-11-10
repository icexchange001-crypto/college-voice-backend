-- Migration: Add media fields to events table
-- This migration adds support for YouTube, Instagram, image, and video URLs to events

-- Add media columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS formatted_message TEXT;

-- Add comments for documentation
COMMENT ON COLUMN events.youtube_url IS 'YouTube video URL for the event';
COMMENT ON COLUMN events.instagram_url IS 'Instagram post/reel URL for the event';
COMMENT ON COLUMN events.image_url IS 'Image URL for the event';
COMMENT ON COLUMN events.video_url IS 'Local video URL for the event';
COMMENT ON COLUMN events.formatted_message IS 'Formatted message with emojis for display on landing page';
