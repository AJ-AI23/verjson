-- ============================================
-- Step 1: Create secure table for API key hashes
-- ============================================
-- This table stores the sensitive key_hash values with NO direct user access
CREATE TABLE public.api_key_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL UNIQUE,
  key_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_key_secrets ENABLE ROW LEVEL SECURITY;

-- CRITICAL: No policies = no access for regular users
-- Only service_role and SECURITY DEFINER functions can access this table
-- Users cannot read, insert, update, or delete from this table directly

-- ============================================
-- Step 2: Migrate existing key_hash data
-- ============================================
INSERT INTO public.api_key_secrets (api_key_id, key_hash, created_at)
SELECT id, key_hash, created_at FROM public.api_keys;

-- ============================================
-- Step 3: Create secure function to store API key hash
-- ============================================
CREATE OR REPLACE FUNCTION public.store_api_key_hash(
  p_api_key_id uuid,
  p_key_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO api_key_secrets (api_key_id, key_hash)
  VALUES (p_api_key_id, p_key_hash);
END;
$$;

-- ============================================
-- Step 4: Update validate_api_key to use secure table
-- ============================================
DROP FUNCTION IF EXISTS public.validate_api_key(text, text);

CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_prefix text, p_key_hash text)
RETURNS TABLE(user_id uuid, scopes api_key_scope[], key_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_record RECORD;
BEGIN
  -- Find API key by prefix and hash (joining to secure table)
  SELECT ak.id, ak.user_id, ak.scopes, ak.is_active, ak.expires_at
  INTO v_key_record
  FROM api_keys ak
  INNER JOIN api_key_secrets aks ON aks.api_key_id = ak.id
  WHERE ak.key_prefix = p_key_prefix
    AND aks.key_hash = p_key_hash
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now())
  LIMIT 1;
  
  IF v_key_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Update last_used_at
  UPDATE api_keys SET last_used_at = now() WHERE id = v_key_record.id;
  
  RETURN QUERY SELECT v_key_record.user_id, v_key_record.scopes, v_key_record.id;
END;
$$;

-- ============================================
-- Step 5: Create function to delete API key hash
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_api_key_hash(p_api_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM api_key_secrets WHERE api_key_id = p_api_key_id;
END;
$$;

-- ============================================
-- Step 6: Remove key_hash from api_keys table
-- ============================================
ALTER TABLE public.api_keys DROP COLUMN key_hash;

-- ============================================
-- Step 7: Add foreign key for cascade delete
-- ============================================
ALTER TABLE public.api_key_secrets
ADD CONSTRAINT fk_api_key_secrets_api_key_id 
FOREIGN KEY (api_key_id) 
REFERENCES public.api_keys(id) 
ON DELETE CASCADE;