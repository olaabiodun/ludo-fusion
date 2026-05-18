-- ============================================================
-- ADMIN DETAIL RPCs
-- Run this in Supabase SQL Editor after supabase_admin_setup.sql
-- ============================================================

-- ============================================================
-- SECTION 1: Game Detail (for admin modal)
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
-- SECTION 2: Room Detail (for admin modal)
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
-- SECTION 3: Transaction Detail (for admin modal)
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
