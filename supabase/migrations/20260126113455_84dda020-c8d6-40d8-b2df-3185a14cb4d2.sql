-- Ensure RLS is enabled on yjs_documents table
ALTER TABLE public.yjs_documents ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (prevents bypassing RLS)
ALTER TABLE public.yjs_documents FORCE ROW LEVEL SECURITY;