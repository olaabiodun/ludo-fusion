-- ─── LUDO FUSION: MISSIONS & DAILY REWARDS SETUP ───

-- 1. Missions Table (Static Definitions)
CREATE TABLE IF NOT EXISTS public.missions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  reward      DECIMAL NOT NULL,
  xp_reward   INTEGER DEFAULT 100,
  target      INTEGER NOT NULL,
  icon        TEXT DEFAULT 'dice-5',
  color       TEXT DEFAULT '#D4AF37',
  category    TEXT DEFAULT 'daily' -- 'daily', 'weekly', 'achievement'
);

-- 2. User Missions (Progress Tracking)
CREATE TABLE IF NOT EXISTS public.user_missions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mission_id  UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  progress    INTEGER DEFAULT 0,
  is_claimed  BOOLEAN DEFAULT false,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, mission_id)
);

-- 3. Daily Rewards (Static Definitions)
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  day_number  INTEGER PRIMARY KEY,
  label       TEXT NOT NULL,
  reward_type TEXT CHECK (reward_type IN ('cash', 'xp')),
  amount      DECIMAL NOT NULL,
  icon        TEXT,
  color       TEXT
);

-- 4. User Daily Claims
CREATE TABLE IF NOT EXISTS public.user_daily_claims (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_number  INTEGER REFERENCES public.daily_rewards(day_number) ON DELETE CASCADE NOT NULL,
  claimed_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, day_number)
);

-- ─── INITIAL DATA SEED ───

INSERT INTO public.missions (title, reward, xp_reward, target, icon, color)
VALUES 
  ('Win 3 Ludo games', 150, 120, 3, 'dice-5', '#D4AF37'),
  ('Play 5 Whot rounds', 100, 80, 5, 'cards-playing-outline', '#F26B6B'),
  ('Earn ₦1,000 in total', 500, 300, 1000, 'cash-check', '#D4AF37'),
  ('Invite a friend', 200, 150, 1, 'account-plus', '#57D08B'),
  ('Win a ₦500 stake game', 250, 200, 1, 'cash', '#57D08B')
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_rewards (day_number, label, reward_type, amount, icon, color)
VALUES
  (1, '₦50', 'cash', 50, 'cash', '#57D08B'),
  (2, '₦100', 'cash', 100, 'cash-multiple', '#57D08B'),
  (3, 'XP ×200', 'xp', 200, 'star-shooting', '#A78BFA'),
  (4, '₦200', 'cash', 200, 'cash', '#D4AF37'),
  (5, '₦300', 'cash', 300, 'cash-multiple', '#D4AF37'),
  (6, 'XP ×500', 'xp', 500, 'star-shooting', '#A78BFA'),
  (7, '₦1,000', 'cash', 1000, 'trophy', '#D4AF37')
ON CONFLICT DO NOTHING;

-- ─── RLS POLICIES ───

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_claims ENABLE ROW LEVEL SECURITY;

-- Selects
CREATE POLICY "Anyone can view missions" ON public.missions FOR SELECT USING (true);
CREATE POLICY "Anyone can view daily rewards" ON public.daily_rewards FOR SELECT USING (true);
CREATE POLICY "Users can view their own mission progress" ON public.user_missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own claims" ON public.user_daily_claims FOR SELECT USING (auth.uid() = user_id);

-- ─── HELPER FUNCTIONS ───

-- Claim a mission reward
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mission public.missions;
  v_user_mission public.user_missions;
BEGIN
  -- 1. Check if user is authenticated
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- 2. Get mission and user progress
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  SELECT * INTO v_user_mission FROM public.user_missions WHERE user_id = v_user_id AND mission_id = p_mission_id;

  -- 3. Validation
  IF v_user_mission IS NULL THEN RAISE EXCEPTION 'Mission not started'; END IF;
  IF v_user_mission.is_claimed THEN RAISE EXCEPTION 'Already claimed'; END IF;
  IF v_user_mission.progress < v_mission.target THEN RAISE EXCEPTION 'Mission not completed'; END IF;

  -- 4. Mark as claimed
  UPDATE public.user_missions SET is_claimed = true WHERE id = v_user_mission.id;

  -- 5. Payout (Cash)
  IF v_mission.reward > 0 THEN
    INSERT INTO public.transactions (player_id, amount, type, status, description)
    VALUES (v_user_id, v_mission.reward, 'deposit', 'completed', 'Mission Reward: ' || v_mission.title);
  END IF;

  -- 6. Payout (XP)
  IF v_mission.xp_reward > 0 THEN
    UPDATE public.profiles SET xp = xp + v_mission.xp_reward WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', v_mission.reward, 'xp', v_mission.xp_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Claim a daily reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_day INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward public.daily_rewards;
  v_streak INTEGER;
BEGIN
  -- 1. Check if user is authenticated
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- 2. Get the reward definition
  SELECT * INTO v_reward FROM public.daily_rewards WHERE day_number = p_day;
  IF v_reward IS NULL THEN RAISE EXCEPTION 'Invalid day'; END IF;

  -- 3. Check if already claimed today
  IF EXISTS (SELECT 1 FROM public.user_daily_claims WHERE user_id = v_user_id AND day_number = p_day) THEN
    RAISE EXCEPTION 'Already claimed for this day'; END IF;

  -- 4. Record claim
  INSERT INTO public.user_daily_claims (user_id, day_number) VALUES (v_user_id, p_day);

  -- 5. Payout Cash
  IF v_reward.reward_type = 'cash' THEN
    INSERT INTO public.transactions (player_id, amount, type, status, description)
    VALUES (v_user_id, v_reward.amount, 'deposit', 'completed', 'Daily Reward Day ' || p_day);
  END IF;

  -- 6. Payout XP
  IF v_reward.reward_type = 'xp' THEN
    UPDATE public.profiles SET xp = xp + v_reward.amount WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', v_reward.amount, 'type', v_reward.reward_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
