-- Step 1: Clean up existing duplicate initial versions (keep the earliest one for each document)
DELETE FROM document_versions 
WHERE id IN (
  SELECT id 
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY document_id, description ORDER BY created_at ASC) as rn
    FROM document_versions 
    WHERE description = 'Initial version'
  ) ranked 
  WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent duplicate initial versions
CREATE UNIQUE INDEX idx_document_initial_version 
ON document_versions (document_id, description) 
WHERE description = 'Initial version';

-- Step 3: Add function to safely create initial version (handles duplicates gracefully)
CREATE OR REPLACE FUNCTION create_initial_version_safe(
  p_document_id UUID, 
  p_user_id UUID, 
  p_content JSONB
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_version_id UUID;
  v_existing_count INTEGER;
BEGIN
  -- Check if initial version already exists
  SELECT COUNT(*) INTO v_existing_count
  FROM document_versions 
  WHERE document_id = p_document_id 
    AND description = 'Initial version';
    
  -- If initial version already exists, return existing ID
  IF v_existing_count > 0 THEN
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
  END IF;
  
  -- Create initial version
  INSERT INTO document_versions (
    document_id, 
    user_id, 
    version_major, 
    version_minor, 
    version_patch,
    description, 
    tier, 
    is_released, 
    is_selected,
    full_document
  ) VALUES (
    p_document_id, 
    p_user_id, 
    0, 
    1, 
    0,
    'Initial version', 
    'minor', 
    true, 
    true,
    p_content
  ) 
  RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition - return existing initial version ID
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
END;
$function$;