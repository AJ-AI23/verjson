-- Make storage buckets private and update RLS policies

-- 1. Make buckets private
UPDATE storage.buckets SET public = false WHERE id = 'diagram-renders';
UPDATE storage.buckets SET public = false WHERE id = 'markdown-renders';

-- 2. Remove existing public read policies
DROP POLICY IF EXISTS "Public read access for diagram renders" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view markdown renders" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for renders of public documents" ON storage.objects;

-- 3. Create new restricted policies for diagram-renders
-- Only authenticated users with document access can view renders
CREATE POLICY "Users can view renders for their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diagram-renders' AND
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id::text = split_part(name, '/', 1)
    AND (
      d.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_permissions wp
        WHERE wp.workspace_id = d.workspace_id
        AND wp.user_id = auth.uid()
        AND wp.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1 FROM public.document_permissions dp
        WHERE dp.document_id = d.id
        AND dp.user_id = auth.uid()
        AND dp.status = 'accepted'
      )
    )
  )
);

-- 4. Create new restricted policies for markdown-renders
-- Only authenticated users with document access can view renders
CREATE POLICY "Users can view markdown renders for their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'markdown-renders' AND
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id::text = split_part(name, '/', 1)
    AND (
      d.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_permissions wp
        WHERE wp.workspace_id = d.workspace_id
        AND wp.user_id = auth.uid()
        AND wp.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1 FROM public.document_permissions dp
        WHERE dp.document_id = d.id
        AND dp.user_id = auth.uid()
        AND dp.status = 'accepted'
      )
    )
  )
);