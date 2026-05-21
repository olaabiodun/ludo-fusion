-- Financial Security Migration
-- 1. Remove insecure transaction insert policy
DROP POLICY IF EXISTS "Users can insert their own transactions." ON public.transactions;

-- 2. Create secure RPC for claiming Ludo/Snake wins
CREATE OR REPLACE FUNCTION public.claim_game_win(p_room_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_room RECORD;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  
  IF v_room.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Room not found');
  END IF;

  IF v_room.status != 'playing' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Room is not active or already finished');
  END IF;

  -- Verify the caller is actually in the room (prevent randos from claiming)
  -- The players column is a JSONB array of objects like {"id": "uid", ...}
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_room.players) AS p 
      WHERE p->>'id' = auth.uid()::TEXT
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not a participant in this room');
  END IF;

  -- Update room status, triggering payout_game_winner!
  UPDATE public.game_rooms 
  SET status = 'finished', winner_id = auth.uid()
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create secure RPC for Matchmaking Deductions (avoids Node.js race conditions)
CREATE OR REPLACE FUNCTION public.matchmaking_deduct(
  p_user_id UUID,
  p_amount DECIMAL,
  p_game_label TEXT,
  p_max_players INT
) RETURNS JSONB AS $$
DECLARE
  v_bal DECIMAL;
BEGIN
  SELECT wallet_balance INTO v_bal FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  IF v_bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  INSERT INTO public.transactions (player_id, amount, type, status, description)
  VALUES (p_user_id, p_amount, 'matchmaking_stake', 'completed', p_max_players::TEXT || 'P ' || p_game_label || ' Match - Entry Fee');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create secure RPC for Matchmaking Refunds (avoids Node.js race conditions)
CREATE OR REPLACE FUNCTION public.matchmaking_refund(
  p_user_id UUID,
  p_amount DECIMAL,
  p_game_label TEXT,
  p_max_players INT
) RETURNS JSONB AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;

  INSERT INTO public.transactions (player_id, amount, type, status, description)
  VALUES (p_user_id, p_amount, 'matchmaking_refund', 'completed', p_max_players::TEXT || 'P ' || p_game_label || ' Match - Refund');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
