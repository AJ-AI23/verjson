-- Fix orphaned workspace by creating missing owner permission
INSERT INTO workspace_permissions (workspace_id, user_id, role, granted_by)
SELECT w.id, w.user_id, 'owner', w.user_id 
FROM workspaces w 
LEFT JOIN workspace_permissions wp ON w.id = wp.workspace_id AND wp.user_id = w.user_id AND wp.role = 'owner'
WHERE wp.workspace_id IS NULL;