-- ============================================================
-- OBFUSCATED SYS_CONFIG TABLE (replaces platform_config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sys_config (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  patch_version TEXT    NOT NULL DEFAULT '0x01',
  updated_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.sys_config (id, patch_version)
VALUES (1, '0x01')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sys_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_select" ON public.sys_config FOR SELECT USING (true);
CREATE POLICY "admin_update" ON public.sys_config
  FOR UPDATE USING (public.is_admin());

-- RPC for admin panel
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
    'patch_version', patch_version,
    'updated_at',    updated_at
  ) INTO config
  FROM public.sys_config
  WHERE id = 1;
  RETURN config;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_feature(
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_mask INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Bit 0 = feature flag (0x01=on, 0x00=off)
  new_mask := CASE WHEN p_enabled THEN 1 ELSE 0 END;

  UPDATE public.sys_config
  SET patch_version = format('0x%X', new_mask),
      updated_by = auth.uid(),
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'patch_version', format('0x%X', new_mask)
  );
END;
$$;
