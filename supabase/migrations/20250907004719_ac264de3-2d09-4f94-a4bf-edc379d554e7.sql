-- Optimize notifications table for better realtime performance
ALTER TABLE public.notifications REPLICA IDENTITY DEFAULT;

-- Add indexes for better query performance on realtime filters
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- Optimize workspace_permissions table for realtime
ALTER TABLE public.workspace_permissions REPLICA IDENTITY DEFAULT;
CREATE INDEX IF NOT EXISTS idx_workspace_permissions_user_status ON public.workspace_permissions(user_id, status) WHERE status = 'pending';