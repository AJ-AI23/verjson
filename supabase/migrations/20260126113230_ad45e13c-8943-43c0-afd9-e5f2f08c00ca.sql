-- Ensure RLS is enabled on api_key_secrets table
ALTER TABLE public.api_key_secrets ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies that might exist
DROP POLICY IF EXISTS "api_key_secrets_select" ON public.api_key_secrets;
DROP POLICY IF EXISTS "api_key_secrets_insert" ON public.api_key_secrets;
DROP POLICY IF EXISTS "api_key_secrets_update" ON public.api_key_secrets;
DROP POLICY IF EXISTS "api_key_secrets_delete" ON public.api_key_secrets;

-- Create restrictive policies that block ALL direct access
-- The validate_api_key SECURITY DEFINER function handles validation
-- The store_api_key_hash and delete_api_key_hash SECURITY DEFINER functions handle mutations

-- Block all direct SELECT access - validation happens via validate_api_key function
CREATE POLICY "No direct select access to api_key_secrets"
ON public.api_key_secrets
FOR SELECT
USING (false);

-- Block all direct INSERT access - use store_api_key_hash function instead
CREATE POLICY "No direct insert access to api_key_secrets"
ON public.api_key_secrets
FOR INSERT
WITH CHECK (false);

-- Block all direct UPDATE access - key hashes should never be updated
CREATE POLICY "No direct update access to api_key_secrets"
ON public.api_key_secrets
FOR UPDATE
USING (false);

-- Block all direct DELETE access - use delete_api_key_hash function instead
CREATE POLICY "No direct delete access to api_key_secrets"
ON public.api_key_secrets
FOR DELETE
USING (false);