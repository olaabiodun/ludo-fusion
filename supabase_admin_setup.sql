-- ============================================================
-- WINNERSON ADMIN SETUP
-- Run this in Supabase SQL Editor (one section at a time)
-- ============================================================

-- ============================================================
-- SECTION 1: Admin Users Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can see the admin_users table
CREATE POLICY "admins_select" ON public.admin_users
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- ============================================================
-- SECTION 2: Add banned column to profiles (if not exists)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- ============================================================
-- SECTION 3: Admin Helper Functions
-- ============================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

-- ============================================================
-- SECTION 4: Dashboard Stats
-- ============================================================
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
    'active_users_24h',   v_active_users_24h
  );

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 5: List All Profiles (admin view)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_profiles(
  p_search TEXT DEFAULT '',
  p_page   INT  DEFAULT 1,
  p_limit  INT  DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_offset INT := (p_page - 1) * p_limit;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  WITH filtered AS (
    SELECT
      p.id, p.username, p.full_name, p.avatar_url, p.wallet_balance,
      p.level, p.tier, p.xp, p.streak, p.is_banned, p.created_at,
      COALESCE(ps.total_matches, 0) AS total_matches,
      COALESCE(ps.total_wins, 0) AS total_wins,
      COALESCE(ps.win_rate, 0) AS win_rate
    FROM public.profiles p
    LEFT JOIN public.profile_stats ps ON ps.player_id = p.id
    WHERE
      p_search = '' OR
      p.username ILIKE '%' || p_search || '%' OR
      p.full_name ILIKE '%' || p_search || '%'
    ORDER BY p.created_at DESC
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'data',  COALESCE((SELECT jsonb_agg(row_to_json) FROM (SELECT * FROM filtered LIMIT p_limit OFFSET v_offset) row_to_json), '[]'::jsonb),
    'total', (SELECT cnt FROM total),
    'page',  p_page,
    'pages', GREATEST(1, CEIL((SELECT cnt::DECIMAL FROM total) / p_limit))
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 6: List Game Rooms (admin view)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_rooms(
  p_status TEXT DEFAULT '',
  p_page   INT  DEFAULT 1,
  p_limit  INT  DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_offset INT := (p_page - 1) * p_limit;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  WITH filtered AS (
    SELECT
      gr.id, gr.game_type, gr.stake, gr.status, gr.max_players,
      gr.players, gr.host_id, gr.winner_id, gr.is_private, gr.room_code,
      gr.created_at, gr.updated_at,
      jsonb_build_object('id', h.id, 'username', h.username) AS host
    FROM public.game_rooms gr
    LEFT JOIN public.profiles h ON h.id = gr.host_id
    WHERE
      p_status = '' OR gr.status = p_status
    ORDER BY gr.updated_at DESC
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'data',  COALESCE((SELECT jsonb_agg(row_to_json) FROM (SELECT * FROM filtered LIMIT p_limit OFFSET v_offset) row_to_json), '[]'::jsonb),
    'total', (SELECT cnt FROM total),
    'page',  p_page,
    'pages', GREATEST(1, CEIL((SELECT cnt::DECIMAL FROM total) / p_limit))
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 7: List All Transactions (admin view)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_transactions(
  p_type   TEXT DEFAULT '',
  p_status TEXT DEFAULT '',
  p_page   INT  DEFAULT 1,
  p_limit  INT  DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_offset INT := (p_page - 1) * p_limit;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  WITH filtered AS (
    SELECT
      t.id, t.player_id, t.amount, t.type, t.status, t.description, t.created_at,
      jsonb_build_object('id', p.id, 'username', p.username) AS player
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.id = t.player_id
    WHERE
      (p_type = ''   OR t.type   = p_type) AND
      (p_status = '' OR t.status = p_status)
    ORDER BY t.created_at DESC
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'data',  COALESCE((SELECT jsonb_agg(row_to_json) FROM (SELECT * FROM filtered LIMIT p_limit OFFSET v_offset) row_to_json), '[]'::jsonb),
    'total', (SELECT cnt FROM total),
    'page',  p_page,
    'pages', GREATEST(1, CEIL((SELECT cnt::DECIMAL FROM total) / p_limit))
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 8: Ban / Unban User
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_banned  BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.profiles SET is_banned = p_banned WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_banned', p_banned);
END;
$$;

-- ============================================================
-- SECTION 9: Admin Adjust Wallet Balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id UUID,
  p_amount  DECIMAL,
  p_reason  TEXT DEFAULT 'admin adjustment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (player_id, amount, type, status, description)
  VALUES (p_user_id, p_amount, 'deposit', 'completed', p_reason);

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'amount', p_amount);
END;
$$;

-- ============================================================
-- SECTION 10: Approve / Reject Withdrawal
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_tx_id   UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount   DECIMAL;
  v_player   UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT amount, player_id INTO v_amount, v_player
  FROM public.transactions WHERE id = p_tx_id AND type = 'withdrawal' AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found or already processed');
  END IF;

  IF p_approve THEN
    UPDATE public.transactions SET status = 'completed' WHERE id = p_tx_id;
  ELSE
    -- Refund: return money to wallet
    UPDATE public.transactions SET status = 'failed' WHERE id = p_tx_id;
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_amount WHERE id = v_player;
  END IF;

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

-- ============================================================
-- SECTION 11: Delete Game Room (admin force-close)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_room(
  p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  DELETE FROM public.matchmaking_queue WHERE room_id = p_room_id;
  UPDATE public.game_rooms SET status = 'finished' WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true, 'room_id', p_room_id);
END;
$$;

-- ============================================================
-- SECTION 12: Revenue Report
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_revenue_report(
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1)::INT,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS dt
  ),
  daily_rev AS (
    SELECT
      ds.dt,
      COALESCE(SUM(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) AS deposits,
      COALESCE(SUM(CASE WHEN t.type = 'withdrawal' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) AS withdrawals,
      COALESCE(SUM(CASE WHEN t.type = 'matchmaking_stake' THEN t.amount ELSE 0 END), 0) AS stakes,
      COUNT(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN 1 END) AS deposit_count,
      COUNT(CASE WHEN t.type = 'withdrawal' AND t.status = 'pending' THEN 1 END) AS pending_count
    FROM date_series ds
    LEFT JOIN public.transactions t ON t.created_at::date = ds.dt
    GROUP BY ds.dt
    ORDER BY ds.dt
  ),
  totals AS (
    SELECT
      COALESCE(SUM(deposits), 0) AS total_deposits,
      COALESCE(SUM(withdrawals), 0) AS total_withdrawals
    FROM daily_rev
  )
  SELECT jsonb_build_object(
    'daily',   COALESCE((SELECT jsonb_agg(row_to_json) FROM daily_rev row_to_json), '[]'::jsonb),
    'totals',  (SELECT row_to_json FROM totals row_to_json)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 12: Insert First Admin User
-- ============================================================
-- Run AFTER you have created an admin account via the app or auth UI.
-- Replace 'USER_UUID_HERE' with the actual auth.users id.
--
-- INSERT INTO public.admin_users (user_id, role)
-- VALUES ('USER_UUID_HERE', 'superadmin');
--
-- To find your user UUID, run:
--   SELECT id, email FROM auth.users;

-- ============================================================
-- SECTION 13: Platform Config Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_config (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gambling_mode BOOLEAN NOT NULL DEFAULT true,
  updated_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure the single row exists
INSERT INTO public.platform_config (id, gambling_mode)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read platform config (needed by the app to decide mode)
CREATE POLICY "anyone_select" ON public.platform_config
  FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "admin_update" ON public.platform_config
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- SECTION 14: Get / Set Platform Config (admin RPCs)
-- ============================================================

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
    'updated_at',    updated_at
  ) INTO config
  FROM public.platform_config
  WHERE id = 1;

  RETURN config;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_gambling_mode(
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.platform_config
  SET gambling_mode = p_enabled,
      updated_by = auth.uid(),
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'gambling_mode', p_enabled);
END;
$$;

-- ============================================================
-- SECTION 15: Send Announcement (admin RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_send_announcement(
  p_title   TEXT,
  p_content TEXT,
  p_type    TEXT DEFAULT 'announcement'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  INSERT INTO public.inbox (user_id, type, title, content, sender, is_read)
  VALUES (NULL, p_type, p_title, p_content, 'Admin', false);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- SECTION 16: List All Game History (admin view)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_game_history(
  p_game_type TEXT DEFAULT '',
  p_page   INT  DEFAULT 1,
  p_limit  INT  DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_offset INT := (p_page - 1) * p_limit;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  WITH filtered AS (
    SELECT
      g.id, g.player_id, g.game_type, g.stake, g.win_amount,
      g.result, g.created_at,
      jsonb_build_object('id', p.id, 'username', p.username) AS player
    FROM public.games g
    LEFT JOIN public.profiles p ON p.id = g.player_id
    WHERE
      (p_game_type = '' OR g.game_type = p_game_type)
    ORDER BY g.created_at DESC
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'data',  COALESCE((SELECT jsonb_agg(row_to_json) FROM (SELECT * FROM filtered LIMIT p_limit OFFSET v_offset) row_to_json), '[]'::jsonb),
    'total', (SELECT cnt FROM total),
    'page',  p_page,
    'pages', GREATEST(1, CEIL((SELECT cnt::DECIMAL FROM total) / p_limit))
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 18: Game Detail (for admin modal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_game_detail(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'id', g.id,
    'player_id', g.player_id,
    'game_type', g.game_type,
    'stake', g.stake,
    'win_amount', g.win_amount,
    'result', g.result,
    'created_at', g.created_at,
    'player', jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name)
  ) INTO result
  FROM public.games g
  LEFT JOIN public.profiles p ON p.id = g.player_id
  WHERE g.id = p_game_id;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 19: Room Detail (for admin modal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_room_detail(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_players JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', pp.id,
    'username', pp.username,
    'full_name', pp.full_name,
    'wallet_balance', pp.wallet_balance,
    'color', rp->>'color',
    'is_bot', (rp->>'isBot')::boolean
  )) INTO v_players
  FROM public.game_rooms gr
  CROSS JOIN LATERAL jsonb_array_elements(gr.players::jsonb) AS rp
  LEFT JOIN public.profiles pp ON pp.id = (rp->>'id')::uuid
  WHERE gr.id = p_room_id;

  SELECT jsonb_build_object(
    'id', gr.id,
    'game_type', gr.game_type,
    'stake', gr.stake,
    'status', gr.status,
    'max_players', gr.max_players,
    'is_private', gr.is_private,
    'room_code', gr.room_code,
    'created_at', gr.created_at,
    'updated_at', gr.updated_at,
    'winner_id', gr.winner_id,
    'host', jsonb_build_object('id', h.id, 'username', h.username, 'full_name', h.full_name),
    'players', COALESCE(v_players, '[]'::jsonb)
  ) INTO result
  FROM public.game_rooms gr
  LEFT JOIN public.profiles h ON h.id = gr.host_id
  WHERE gr.id = p_room_id;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 20: Transaction Detail (for admin modal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_transaction_detail(p_tx_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'player_id', t.player_id,
    'amount', t.amount,
    'type', t.type,
    'status', t.status,
    'description', t.description,
    'created_at', t.created_at,
    'player', jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name, 'wallet_balance', p.wallet_balance)
  ) INTO result
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.id = t.player_id
  WHERE t.id = p_tx_id;

  RETURN result;
END;
$$;
