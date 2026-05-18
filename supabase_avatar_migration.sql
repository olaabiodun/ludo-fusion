-- Assign random DiceBear avatars to existing profiles with NULL avatar_url
-- Uses the same seed list as lib/avatars.ts

DO $$
DECLARE
  seeds TEXT[] := ARRAY['Felix','Aneka','Boo','Jasper','Luna','Milo','Simon','Zara','Oscar','Nala','Kai','Remy','Ivy','Leo','Maya','Theo','Eden','Finn','Nova','Cole','Skye','Blake','Jade','Reese','Avery','Quinn','Rowan','Sage','Wren','Drew'];
  bgs TEXT[] := ARRAY['b6e3f4','ffdfbf','c0aede','d1d4f9','ffd5dc','c1f4c1','f0d5c1','c1d4f0','d4f0c1','f0c1d4','c1f0e0','e0c1f0','f5e6cc','ccf5e6','e6ccf5','f5cce6','cce6f5','e6f5cc','d4c4f0','f0d4c4','c4f0d4','d4f0c4','c4d4f0','f0c4d4'];
  rec RECORD;
  seed_idx INT;
  bg_idx INT;
  chosen_url TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE avatar_url IS NULL OR avatar_url = '' LOOP
    seed_idx := floor(random() * array_length(seeds, 1)) + 1;
    bg_idx := floor(random() * array_length(bgs, 1)) + 1;
    chosen_url := 'https://api.dicebear.com/7.x/avataaars/png?seed=' || seeds[seed_idx] || '&backgroundColor=' || bgs[bg_idx];
    UPDATE public.profiles SET avatar_url = chosen_url, updated_at = NOW() WHERE id = rec.id;
  END LOOP;
END $$;
