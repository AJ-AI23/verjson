-- Add bricked status to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS pin_bricked boolean NOT NULL DEFAULT false;

-- Add bricked_at timestamp for tracking when it was bricked
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS pin_bricked_at timestamp with time zone;

-- Create table to track PIN verification attempts
CREATE TABLE IF NOT EXISTS public.pin_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on pin_verification_attempts
ALTER TABLE public.pin_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can access pin_verification_attempts (no user access)
-- This is intentional - attempts are managed by the edge function using service role

-- Create index for efficient querying of recent attempts
CREATE INDEX IF NOT EXISTS idx_pin_verification_attempts_document_id 
ON public.pin_verification_attempts(document_id, attempted_at DESC);

-- Create cleanup function for old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_pin_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pin_verification_attempts 
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- Create function to unbrick a document (owner only)
CREATE OR REPLACE FUNCTION public.unbrick_document(doc_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_owner boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user is the document owner
  SELECT EXISTS (
    SELECT 1 FROM public.documents 
    WHERE id = doc_id AND user_id = v_user_id
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RETURN false;
  END IF;
  
  -- Unbrick the document
  UPDATE public.documents 
  SET pin_bricked = false, pin_bricked_at = null
  WHERE id = doc_id AND user_id = v_user_id;
  
  -- Clear all failed attempts for this document
  DELETE FROM public.pin_verification_attempts 
  WHERE document_id = doc_id;
  
  RETURN true;
END;
$$;