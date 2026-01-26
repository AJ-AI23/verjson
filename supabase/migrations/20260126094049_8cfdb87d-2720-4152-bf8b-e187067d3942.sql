-- Remove the email column from profiles table to prevent exposure
-- Email should only come from auth.users table when needed

-- First, update the profiles_secure view to remove email reference
DROP VIEW IF EXISTS public.profiles_secure;

-- Create new profiles_secure view without email column
CREATE VIEW public.profiles_secure 
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  full_name,
  username,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Drop and recreate get_profile_safely function without email
DROP FUNCTION IF EXISTS public.get_profile_safely(uuid);

CREATE FUNCTION public.get_profile_safely(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = target_user_id;
$$;

-- Now drop the email column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;