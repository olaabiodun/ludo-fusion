-- ============================================================
-- Customer Support Chat System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure the inbox table has a 'support' type (needed if type has a CHECK constraint)
-- First check if there's a constraint and drop/recreate it if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name = 'inbox' AND tc.constraint_type = 'CHECK'
    AND cc.check_clause LIKE '%type%'
  ) THEN
    ALTER TABLE public.inbox DROP CONSTRAINT IF EXISTS inbox_type_check;
    ALTER TABLE public.inbox ADD CONSTRAINT inbox_type_check
      CHECK (type IN ('system', 'game', 'social', 'promo', 'announcement', 'support'));
  END IF;
END $$;

-- 2. Add sender_notification_read column for admin to track which replies
--    have been seen by the user
ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS sender_read BOOLEAN DEFAULT false;

-- 3. RPC for users to send a support message
CREATE OR REPLACE FUNCTION public.send_support_message(p_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RETURN jsonb_build_object('error', 'Message cannot be empty');
  END IF;

  INSERT INTO public.inbox (user_id, type, title, content, sender, is_read)
  VALUES (v_user_id, 'support', 'Support Message', trim(p_content), 'User', false);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. RPC to get support messages for the current user
-- Note: VOLATILE because it also marks admin replies as read
CREATE OR REPLACE FUNCTION public.get_my_support_messages()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',         i.id,
      'content',    i.content,
      'sender',     i.sender,
      'is_read',    i.is_read,
      'created_at', i.created_at
    )
    ORDER BY i.created_at ASC
  ), '[]'::JSONB) INTO result
  FROM public.inbox i
  WHERE i.user_id = v_user_id AND i.type = 'support';

  -- Mark admin replies as read by user
  UPDATE public.inbox
  SET is_read = true
  WHERE user_id = v_user_id AND type = 'support' AND sender = 'Support' AND is_read = false;

  RETURN jsonb_build_object('messages', result);
END;
$$;

-- 5. RPC for admin to list all support conversations
CREATE OR REPLACE FUNCTION public.admin_list_support_conversations()
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

  SELECT COALESCE(jsonb_agg(subq ORDER BY subq.last_message_at DESC), '[]'::JSONB) INTO result
  FROM (
    SELECT
      p.id              AS user_id,
      p.username,
      p.avatar_url,
      p.full_name,
      p.level,
      COUNT(i.id)       AS message_count,
      MAX(i.created_at) AS last_message_at,
      (SELECT i2.content FROM public.inbox i2
       WHERE i2.user_id = p.id AND i2.type = 'support'
       ORDER BY i2.created_at DESC LIMIT 1) AS last_message,
      (SELECT i2.sender FROM public.inbox i2
       WHERE i2.user_id = p.id AND i2.type = 'support'
       ORDER BY i2.created_at DESC LIMIT 1) AS last_sender,
      EXISTS (
        SELECT 1 FROM public.inbox i3
        WHERE i3.user_id = p.id AND i3.type = 'support'
        AND i3.sender = 'User' AND i3.is_read = false
      ) AS has_unread
    FROM public.inbox i
    JOIN public.profiles p ON p.id = i.user_id
    WHERE i.type = 'support'
    GROUP BY p.id, p.username, p.avatar_url, p.full_name, p.level
  ) subq;

  RETURN jsonb_build_object('conversations', result);
END;
$$;

-- 6. RPC for admin to get a single conversation
-- Note: VOLATILE because it also marks unread messages as read by admin
CREATE OR REPLACE FUNCTION public.admin_get_conversation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Get user profile
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id',          p.id,
      'username',    p.username,
      'avatar_url',  p.avatar_url,
      'full_name',   p.full_name,
      'level',       p.level,
      'wallet_balance', p.wallet_balance
    ),
    'messages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         i.id,
          'content',    i.content,
          'sender',     i.sender,
          'is_read',    i.is_read,
          'created_at', i.created_at
        )
        ORDER BY i.created_at ASC
      )
      FROM public.inbox i
      WHERE i.user_id = p_user_id AND i.type = 'support'
    ), '[]'::JSONB)
  ) INTO result
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- Mark unread messages as read by admin
  UPDATE public.inbox
  SET sender_read = true
  WHERE user_id = p_user_id AND type = 'support' AND sender = 'User' AND sender_read = false;

  RETURN result;
END;
$$;

-- 7. RPC for admin to reply to a user's support conversation
CREATE OR REPLACE FUNCTION public.admin_reply_support(p_user_id UUID, p_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RETURN jsonb_build_object('error', 'Message cannot be empty');
  END IF;

  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  INSERT INTO public.inbox (user_id, type, title, content, sender, is_read)
  VALUES (p_user_id, 'support', 'Support Reply', trim(p_content), 'Support', false);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. RPC to get unread support message count for the current user
CREATE OR REPLACE FUNCTION public.get_unread_support_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT
  FROM public.inbox
  WHERE user_id = auth.uid() AND type = 'support' AND sender = 'Support' AND is_read = false;
$$;

-- 9. Enable realtime for the inbox table (needed for live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox;
