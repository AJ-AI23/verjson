-- Fix search_path security issues for the functions we created

-- Update generate_content_hash function with secure search_path
CREATE OR REPLACE FUNCTION public.generate_content_hash(content text)
RETURNS text 
LANGUAGE plpgsql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(digest(content, 'sha256'), 'hex');
END;
$$;

-- Update cleanup_old_editor_history function with secure search_path
CREATE OR REPLACE FUNCTION public.cleanup_old_editor_history()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep only the latest 100 entries per document/user combination
  DELETE FROM public.editor_history 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY document_id, user_id 
        ORDER BY sequence_number DESC
      ) as rn
      FROM public.editor_history
    ) ranked
    WHERE rn <= 100
  );
END;
$$;

-- Update trigger_cleanup_old_history function with secure search_path
CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_history()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only run cleanup occasionally to avoid performance issues
  IF random() < 0.1 THEN -- 10% chance
    PERFORM public.cleanup_old_editor_history();
  END IF;
  RETURN NEW;
END;
$$;