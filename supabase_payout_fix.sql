-- ─── LUDO FUSION: PAYOUT FIX (v2) ───────────────────────────────────────────
-- Run this entire file in your Supabase SQL Editor.
-- Changes from v1:
--   - REMOVED deduct_game_stakes trigger (stake is already deducted by app code)
--   - FIXED payout formula: fee only on OPPONENT's stake, not winner's own stake

-- ─── 1. Drop the erroneous deduct_game_stakes trigger ─────────────────────────
-- This was causing DOUBLE deduction (app code + trigger both deducting stake).
DROP TRIGGER IF EXISTS trg_deduct_game_stakes ON public.game_rooms;
DROP FUNCTION IF EXISTS public.deduct_game_stakes();


-- ─── 2. Fix the payout trigger function ──────────────────────────────────────
-- Correct formula:
--   winner receives:  own_stake (returned in full)
--                   + opponent_stake * (1 - platform_fee)
--   = stake + stake * (max_players - 1) * 0.80  (20% platform fee)
--
-- Example: stake=200, 2 players
--   payout = 200 + 200 * 1 * 0.80 = 200 + 160 = 360
--   net for winner: -200 (deducted on entry) + 360 = +160 ✅
CREATE OR REPLACE FUNCTION public.payout_game_winner()
RETURNS TRIGGER AS $$
DECLARE
  own_stake      DECIMAL(12,2);
  winnings       DECIMAL(12,2);
  platform_fee   DECIMAL(12,2);
  payout         DECIMAL(12,2);
BEGIN
  -- Only fire when room transitions to 'finished' with a winner set
  IF (OLD.status != 'finished' AND NEW.status = 'finished' AND NEW.winner_id IS NOT NULL) THEN

    own_stake := COALESCE(NEW.stake, 0);

    -- Guard: don't pay out if stake is 0 (practice/free games)
    IF own_stake <= 0 THEN
      RETURN NEW;
    END IF;

    -- Winnings = opponents' combined stake minus 20% platform fee
    winnings     := own_stake * (NEW.max_players - 1) * 0.80;
    platform_fee := own_stake * (NEW.max_players - 1) * 0.20;

    -- Total payout = winner's own stake back + net winnings
    payout := own_stake + winnings;

    -- Credit winner
    INSERT INTO public.transactions (player_id, amount, type, status, description)
    VALUES (
      NEW.winner_id,
      payout,
      'deposit',
      'completed',
      'Game Win (' || NEW.game_type || ') — ₦' || payout::TEXT
    );

    RAISE LOG '[payout_game_winner] Room % — Winner % paid ₦% (own: ₦% + winnings: ₦%, fee: ₦%)',
      NEW.id, NEW.winner_id, payout, own_stake, winnings, platform_fee;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 3. Re-attach payout trigger ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_payout_game_winner ON public.game_rooms;
CREATE TRIGGER trg_payout_game_winner
  AFTER UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.payout_game_winner();


-- ─── 4. Ensure game_state column exists (used by server to store scores) ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'game_rooms'
      AND column_name  = 'game_state'
  ) THEN
    ALTER TABLE public.game_rooms ADD COLUMN game_state JSONB DEFAULT '{}';
  END IF;
END $$;


-- ─── 5. Verify ────────────────────────────────────────────────────────────────
-- Run these after applying to confirm everything is correct:
--
-- SELECT trigger_name, event_object_table, action_timing
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- ORDER BY trigger_name;
--
-- Expected: trg_payout_game_winner should exist.
--           trg_deduct_game_stakes should NOT exist.
