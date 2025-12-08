-- Create enum for API key scopes
CREATE TYPE public.api_key_scope AS ENUM ('read', 'write', 'admin');

-- Create API keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes api_key_scope[] NOT NULL DEFAULT ARRAY['read']::api_key_scope[],
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_api_keys_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

-- Create index for faster lookups by key prefix
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

-- Enable Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own API keys
CREATE POLICY "Users can view their own API keys"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
ON public.api_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
ON public.api_keys
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
ON public.api_keys
FOR DELETE
USING (auth.uid() = user_id);

-- Function to validate API key and get user info
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_prefix TEXT, p_key_hash TEXT)
RETURNS TABLE(
  user_id UUID,
  scopes api_key_scope[],
  key_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_record RECORD;
BEGIN
  -- Find API key by prefix and hash
  SELECT ak.id, ak.user_id, ak.scopes, ak.is_active, ak.expires_at
  INTO v_key_record
  FROM api_keys ak
  WHERE ak.key_prefix = p_key_prefix
    AND ak.key_hash = p_key_hash
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

-- Trigger to update updated_at on api_keys
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();