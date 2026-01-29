-- Update the create_initial_version_safe function to use 0.0.1 instead of 0.1.0
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
    
  IF v_existing_count > 0 THEN
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
  END IF;
  
  -- Create initial version with 0.0.1 (changed from 0.1.0)
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
    0,  -- major
    0,  -- minor (changed from 1)
    1,  -- patch
    'Initial version', 
    'patch',  -- tier (changed from 'minor')
    true, 
    true,
    p_content
  ) 
  RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_version_id
    FROM document_versions 
    WHERE document_id = p_document_id 
      AND description = 'Initial version'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RETURN v_version_id;
END;
$function$;