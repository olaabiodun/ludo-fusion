-- ─── LUDO FUSION: SNAKE & LADDER + TRANSACTION TYPES FIX ───
-- Run this in your Supabase SQL Editor.

-- 1. Relax game_type constraint in game_rooms
-- First, drop the existing constraint if it exists
ALTER TABLE public.game_rooms DROP CONSTRAINT IF EXISTS game_rooms_game_type_check;

-- Add updated constraint including 'snake_ladder'
ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_game_type_check 
  CHECK (game_type IN ('ludo', 'whot', 'ludo_t', 'whot_t', 'snake_ladder'));

-- 2. Relax type constraint in transactions
-- First, drop the existing constraint if it exists
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add updated constraint including matchmaking types
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'matchmaking_stake', 'matchmaking_refund'));

-- 3. Ensure games table (history) also accepts the new type
-- Drop if exists
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_game_type_check;

-- Add updated constraint
-- Using a broad check or no check is often better for future-proofing
-- but let's keep it consistent for now.
ALTER TABLE public.games ADD CONSTRAINT games_game_type_check 
  CHECK (game_type IN ('ludo', 'whot', 'snake_ladder'));

DO $$ 
BEGIN
  RAISE LOG 'Snake & Ladder and Transaction types updated successfully.';
END $$;
