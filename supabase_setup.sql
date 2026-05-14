-- ─── LUDO FUSION DATABASE SETUP ───
-- Run this ENTIRE file in your Supabase SQL Editor (https://app.supabase.com)
-- It is safe to run multiple times — uses IF NOT EXISTS / DO blocks.

-- ─── 1. PROFILES TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username      TEXT UNIQUE,
  full_name     TEXT,
  avatar_url    TEXT,
  wallet_balance DECIMAL DEFAULT 0.0,
  level         INTEGER DEFAULT 1,
  xp            INTEGER DEFAULT 0,
  xp_next_level INTEGER DEFAULT 3000,
  streak        INTEGER DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT username_length CHECK (CHAR_LENGTH(username) >= 4)
);

-- Add new columns to existing profiles table (safe for existing users)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'level') THEN
    ALTER TABLE public.profiles ADD COLUMN level INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp') THEN
    ALTER TABLE public.profiles ADD COLUMN xp INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp_next_level') THEN
    ALTER TABLE public.profiles ADD COLUMN xp_next_level INTEGER DEFAULT 3000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'streak') THEN
    ALTER TABLE public.profiles ADD COLUMN streak INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tier') THEN
    ALTER TABLE public.profiles ADD COLUMN tier TEXT DEFAULT 'newcomer';
  END IF;
END $$;

-- ─── AUTO-COMPUTE TIER FROM LEVEL ─────────────────────────────────────────────
-- Returns the tier name string based on level
CREATE OR REPLACE FUNCTION public.get_tier_from_level(p_level INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF p_level >= 25 THEN RETURN 'mythic_legend';
  ELSIF p_level >= 20 THEN RETURN 'legendary';
  ELSIF p_level >= 15 THEN RETURN 'grand_master';
  ELSIF p_level >= 10 THEN RETURN 'elite';
  ELSIF p_level >= 5  THEN RETURN 'rising_star';
  ELSE RETURN 'newcomer';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: auto-update tier column whenever level changes
CREATE OR REPLACE FUNCTION public.sync_tier_on_level_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := public.get_tier_from_level(NEW.level);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tier ON public.profiles;
CREATE TRIGGER trg_sync_tier
  BEFORE INSERT OR UPDATE OF level ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_tier_on_level_change();

-- Backfill tier for all existing users
UPDATE public.profiles SET tier = public.get_tier_from_level(COALESCE(level, 1));

-- ─── 2. ROW LEVEL SECURITY ────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ─── 3. AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username, created_at)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    split_part(new.email, '@', 1) || '_' || floor(random() * 1000)::text,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Safe for existing users
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 4. GAMES TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_type   TEXT NOT NULL,
  table_name  TEXT DEFAULT 'Classic Room',
  stake       DECIMAL DEFAULT 0.0,
  win_amount  DECIMAL DEFAULT 0.0,
  result      TEXT DEFAULT 'completed',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe migration: add columns to existing games table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'result') THEN
    ALTER TABLE public.games ADD COLUMN result TEXT DEFAULT 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'table_name') THEN
    ALTER TABLE public.games ADD COLUMN table_name TEXT DEFAULT 'Classic Room';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'win_amount') THEN
    ALTER TABLE public.games ADD COLUMN win_amount DECIMAL DEFAULT 0.0;
  END IF;
END $$;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own game history." ON public.games;
CREATE POLICY "Users can view their own game history."
  ON public.games FOR SELECT USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can log their own games." ON public.games;
CREATE POLICY "Users can log their own games."
  ON public.games FOR INSERT WITH CHECK (auth.uid() = player_id);

-- ─── 5. PROFILE STATS VIEW ────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.profile_stats;
CREATE VIEW public.profile_stats AS
SELECT
  g.player_id,
  COUNT(*)                                                AS total_matches,
  COUNT(*) FILTER (WHERE g.result = 'win')               AS total_wins,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE g.result = 'win')
    / NULLIF(COUNT(*), 0)
  )::INTEGER                                             AS win_rate
FROM public.games g
GROUP BY g.player_id;

-- ─── 6. FRIENDSHIPS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate friend requests between same pair
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can see friendships they are part of
DROP POLICY IF EXISTS "Users can view their own friendships." ON public.friendships;
CREATE POLICY "Users can view their own friendships."
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can send friend requests (insert)
DROP POLICY IF EXISTS "Users can send friend requests." ON public.friendships;
CREATE POLICY "Users can send friend requests."
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Addressee can accept (update status)
DROP POLICY IF EXISTS "Users can accept friend requests." ON public.friendships;
CREATE POLICY "Users can accept friend requests."
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

-- Either party can remove/decline the friendship
DROP POLICY IF EXISTS "Users can remove friendships." ON public.friendships;
CREATE POLICY "Users can remove friendships."
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ─── 7. TRANSACTIONS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  type          TEXT CHECK (type IN ('deposit', 'withdrawal', 'transfer')),
  status        TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  recipient_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- For transfers
  description   TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
CREATE POLICY "Users can view their own transactions."
  ON public.transactions FOR SELECT
  USING (auth.uid() = player_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can insert their own transactions." ON public.transactions;
CREATE POLICY "Users can insert their own transactions."
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Trigger to update wallet_balance on new transaction
CREATE OR REPLACE FUNCTION public.update_wallet_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- If it's a deposit, add to player's balance
  IF (NEW.type = 'deposit' AND NEW.status = 'completed') THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + NEW.amount WHERE id = NEW.player_id;
  
  -- If it's a withdrawal, subtract from player's balance
  ELSIF (NEW.type = 'withdrawal' AND NEW.status = 'completed') THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance - NEW.amount WHERE id = NEW.player_id;
  
  -- If it's a transfer
  ELSIF (NEW.type = 'transfer' AND NEW.status = 'completed') THEN
    -- Subtract from sender
    UPDATE public.profiles SET wallet_balance = wallet_balance - NEW.amount WHERE id = NEW.player_id;
    -- Add to recipient
    IF (NEW.recipient_id IS NOT NULL) THEN
      UPDATE public.profiles SET wallet_balance = wallet_balance + NEW.amount WHERE id = NEW.recipient_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_wallet_on_tx ON public.transactions;
CREATE TRIGGER trg_update_wallet_on_tx
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_wallet_on_transaction();

-- ─── 8. MATCHMAKING & GAMES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type     TEXT CHECK (game_type IN ('ludo', 'whot', 'ludo_t', 'whot_t')),
  stake         DECIMAL(12,2) NOT NULL,
  max_players   INT CHECK (max_players IN (2, 4)),
  status        TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'playing', 'finished')),
  host_id       UUID REFERENCES public.profiles(id),
  players       JSONB DEFAULT '[]', -- Array of { id, username, avatar, color, ready }
  game_state    JSONB DEFAULT '{}', -- Full serialized engine state
  winner_id     UUID REFERENCES public.profiles(id),
  is_private    BOOLEAN DEFAULT false,
  room_code     TEXT UNIQUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for game_rooms updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_rooms_updated_at ON public.game_rooms;
CREATE TRIGGER trg_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id     UUID REFERENCES public.profiles(id) UNIQUE NOT NULL,
  game_type     TEXT,
  stake         DECIMAL(12,2),
  max_players   INT,
  room_id       UUID REFERENCES public.game_rooms(id), -- Updated when a match is found
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Game Rooms
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active game rooms." ON public.game_rooms;
CREATE POLICY "Anyone can view active game rooms." ON public.game_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can update rooms they are in." ON public.game_rooms;
CREATE POLICY "Players can update rooms they are in." ON public.game_rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(players) as p
    WHERE (p->>'id')::UUID = auth.uid()
  ) OR host_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can create rooms." ON public.game_rooms;
CREATE POLICY "Users can create rooms." ON public.game_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

-- RLS for Matchmaking
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own queue entry." ON public.matchmaking_queue;
CREATE POLICY "Users can manage their own queue entry." ON public.matchmaking_queue
  FOR ALL 
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- Trigger: When a game room is finished, pay out the winner (simplified)
CREATE OR REPLACE FUNCTION public.payout_game_winner()
RETURNS TRIGGER AS $$
DECLARE
  total_pot DECIMAL(12,2);
  platform_fee DECIMAL(12,2);
  payout DECIMAL(12,2);
BEGIN
  IF (OLD.status != 'finished' AND NEW.status = 'finished' AND NEW.winner_id IS NOT NULL) THEN
    total_pot := NEW.stake * NEW.max_players;
    platform_fee := total_pot * 0.1;
    payout := total_pot - platform_fee;

    -- Record winning transaction
    INSERT INTO public.transactions (player_id, amount, type, status, description)
    VALUES (NEW.winner_id, payout, 'deposit', 'completed', 'Game Winning: ' || NEW.game_type);
    
    -- Balance update is handled by the update_wallet_on_transaction trigger
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payout_game_winner ON public.game_rooms;
CREATE TRIGGER trg_payout_game_winner
  AFTER UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.payout_game_winner();
