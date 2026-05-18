-- ============================================================
-- Online Presence Tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add last_seen column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- 2. RPC for mobile app to update last_seen heartbeat
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.profiles
  SET last_seen = NOW()
  WHERE id = auth.uid();
$$;

-- 3. Update admin_dashboard_stats to include online_now
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_total_players     INT;
  v_active_rooms      INT;
  v_total_revenue     DECIMAL;
  v_pending_withdraw  DECIMAL;
  v_today_signups     INT;
  v_total_deposits    DECIMAL;
  v_total_withdrawals DECIMAL;
  v_today_revenue     DECIMAL;
  v_total_games       INT;
  v_platform_fees     DECIMAL;
  v_active_users_24h  INT;
  v_online_now        INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_total_players FROM public.profiles;
  SELECT COUNT(*) INTO v_active_rooms FROM public.game_rooms WHERE status IN ('waiting', 'starting', 'playing');
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue FROM public.transactions WHERE type = 'deposit' AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdraw FROM public.transactions WHERE type = 'withdrawal' AND status = 'pending';
  SELECT COUNT(*) INTO v_today_signups FROM public.profiles WHERE created_at >= CURRENT_DATE;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits FROM public.transactions WHERE type = 'deposit' AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals FROM public.transactions WHERE type = 'withdrawal' AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO v_today_revenue FROM public.transactions WHERE type = 'deposit' AND status = 'completed' AND created_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_total_games FROM public.games;
  SELECT COALESCE(SUM(ROUND(stake * 0.2, 2)), 0) INTO v_platform_fees FROM public.game_rooms WHERE status = 'finished' AND stake > 0;
  SELECT COUNT(DISTINCT player_id) INTO v_active_users_24h FROM public.games WHERE created_at >= NOW() - INTERVAL '24 hours';
  SELECT COUNT(*) INTO v_online_now FROM public.profiles WHERE last_seen >= NOW() - INTERVAL '2 minutes';

  result := jsonb_build_object(
    'total_players',      v_total_players,
    'active_rooms',       v_active_rooms,
    'total_revenue',      v_total_revenue,
    'pending_withdraw',   v_pending_withdraw,
    'today_signups',      v_today_signups,
    'total_deposits',     v_total_deposits,
    'total_withdrawals',  v_total_withdrawals,
    'today_revenue',      v_today_revenue,
    'total_games',        v_total_games,
    'platform_fees',      v_platform_fees,
    'active_users_24h',   v_active_users_24h,
    'online_now',         v_online_now
  );

  RETURN result;
END;
$$;

-- 4. RPC to list currently online users (for admin panel)
CREATE OR REPLACE FUNCTION public.admin_online_users()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  users  JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             p.id,
      'username',       p.username,
      'full_name',      p.full_name,
      'avatar_url',     p.avatar_url,
      'level',          p.level,
      'tier',           p.tier,
      'wallet_balance', p.wallet_balance,
      'last_seen',      p.last_seen,
      'seconds_ago',    EXTRACT(EPOCH FROM NOW() - p.last_seen)::INT
    )
    ORDER BY p.last_seen DESC
  ), '[]'::JSONB) INTO users
  FROM public.profiles p
  WHERE p.last_seen >= NOW() - INTERVAL '2 minutes';

  result := jsonb_build_object(
    'users', users,
    'count', jsonb_array_length(users)
  );

  RETURN result;
END;
$$;
