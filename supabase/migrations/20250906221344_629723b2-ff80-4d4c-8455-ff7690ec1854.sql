-- Clean up orphaned records before adding foreign keys

-- Remove workspace permissions that reference non-existent workspaces
DELETE FROM public.workspace_permissions 
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);

-- Remove document permissions that reference non-existent documents  
DELETE FROM public.document_permissions 
WHERE document_id NOT IN (SELECT id FROM public.documents);

-- Remove notifications that reference non-existent profiles
DELETE FROM public.notifications 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);

-- Remove workspace permissions that reference non-existent profiles
DELETE FROM public.workspace_permissions 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);

-- Remove document permissions that reference non-existent profiles
DELETE FROM public.document_permissions 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);