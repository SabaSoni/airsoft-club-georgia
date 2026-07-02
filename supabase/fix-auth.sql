-- Fix auth/profile issues — run in Supabase SQL Editor
-- Use YOUR email exactly as registered in Authentication → Users

-- 1) Fix trigger so role is always lowercase 'user' (admin set via app API)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Create missing profile for existing auth users
INSERT INTO public.profiles (id, email, name, phone, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'phone',
  'user'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 3) Fix wrong role values (Admin → admin)
UPDATE public.profiles SET role = 'user' WHERE role NOT IN ('user', 'admin');
UPDATE public.profiles SET role = 'admin' WHERE lower(role) = 'admin';

-- 4) Make YOUR account admin (change email if needed!)
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'sonishvillsaba07@gmail.com';

-- 5) Confirm email manually so you can log in immediately
--    (Skip this if you disable "Confirm email" in Supabase Auth settings)
--    Note: confirmed_at is auto-generated — only set email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'sonishvillsaba07@gmail.com';
