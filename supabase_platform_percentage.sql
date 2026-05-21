-- ─── MIGRATION: DYNAMIC PLATFORM COMMISSION PERCENTAGE ───
-- Run this in your Supabase SQL Editor.

-- 1. Add platform_percentage column to platform_config if it doesn't exist
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS platform_percentage DECIMAL(5,2) DEFAULT 10.0;

-- 2. Update existing platform config to default to 10.0 if not already set
UPDATE public.platform_config
SET platform_percentage = 10.0
WHERE platform_percentage IS NULL;

-- 3. Re-create admin_get_config to return platform_percentage
CREATE OR REPLACE FUNCTION public.admin_get_config()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  config JSONB;
BEGIN
  SELECT jsonb_build_object(
    'gambling_mode', gambling_mode,
    'platform_percentage', COALESCE(platform_percentage, 10.0),
    'updated_at',    updated_at
  ) INTO config
  FROM public.platform_config
  WHERE id = 1;

  RETURN config;
END;
$$;

-- 4. Create RPC function to set platform percentage
CREATE OR REPLACE FUNCTION public.admin_set_platform_percentage(
  p_percentage DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_percentage < 0 OR p_percentage > 100 THEN
    RETURN jsonb_build_object('error', 'Percentage must be between 0 and 100');
  END IF;

  UPDATE public.platform_config
  SET platform_percentage = p_percentage,
      updated_by = auth.uid(),
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'platform_percentage', p_percentage);
END;
$$;

-- 5. Update payout_game_winner trigger function to use dynamic platform percentage!
CREATE OR REPLACE FUNCTION public.payout_game_winner()
RETURNS TRIGGER AS $$
DECLARE
  own_stake      DECIMAL(12,2);
  winnings       DECIMAL(12,2);
  platform_fee   DECIMAL(12,2);
  payout         DECIMAL(12,2);
  v_pct          DECIMAL(5,2);
BEGIN
  -- Only fire when room transitions to 'finished' with a winner set
  IF (OLD.status != 'finished' AND NEW.status = 'finished' AND NEW.winner_id IS NOT NULL) THEN

    own_stake := COALESCE(NEW.stake, 0);

    -- Guard: don't pay out if stake is 0 (practice/free games)
    IF own_stake <= 0 THEN
      RETURN NEW;
    END IF;

    -- Fetch the configured platform percentage, defaulting to 10%
    SELECT COALESCE(platform_percentage, 10.0) INTO v_pct
    FROM public.platform_config
    WHERE id = 1;

    IF v_pct IS NULL THEN
      v_pct := 10.0;
    END IF;

    -- Winnings = opponents' combined stake minus platform fee
    winnings     := own_stake * (NEW.max_players - 1) * (1.0 - (v_pct / 100.0));
    platform_fee := own_stake * (NEW.max_players - 1) * (v_pct / 100.0);

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

    RAISE LOG '[payout_game_winner] Room % — Winner % paid ₦% (own: ₦% + winnings: ₦%, fee: ₦% (% percent))',
      NEW.id, NEW.winner_id, payout, own_stake, winnings, platform_fee, v_pct;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
