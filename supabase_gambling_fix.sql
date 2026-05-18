-- ============================================================
-- Fix: Gambling Mode Toggle Not Propagating to App
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enable realtime for platform_config so GamblingContext
--    receives live UPDATE events when admin toggles the mode
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_config;

-- 2. Ensure REPLICA IDENTITY is set properly (needed for UPDATE events)
ALTER TABLE public.platform_config REPLICA IDENTITY DEFAULT;

-- 3. Verify: the publication now includes both tables needed by the app
SELECT pubname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
