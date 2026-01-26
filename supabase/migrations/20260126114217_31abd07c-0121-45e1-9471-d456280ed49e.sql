-- Drop the redundant profiles_secure view
-- This view was originally created to mask emails, but emails have been removed from the profiles table
-- The profiles table now has proper RLS policies and is sufficient for all access control needs
DROP VIEW IF EXISTS public.profiles_secure;