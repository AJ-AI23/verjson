-- Fix overly permissive RLS policies with WITH CHECK (true)

-- 1. Fix document_access_logs INSERT policy
-- This table is for audit logging - only service_role should insert
DROP POLICY IF EXISTS "Service role can insert access logs" ON public.document_access_logs;

CREATE POLICY "Service role can insert access logs"
ON public.document_access_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. Fix notifications INSERT policies
-- The "Service role can create notifications" is already scoped to service_role, but let's ensure it's explicit
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

CREATE POLICY "Service role can create notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. Fix "System can create invitation notifications" - this is the problematic one
-- It allows any authenticated user to create notifications which could be abused
DROP POLICY IF EXISTS "System can create invitation notifications" ON public.notifications;

-- Replace with a policy that only allows users to create notifications for themselves
-- or allow service_role to create for anyone (for system notifications)
CREATE POLICY "Users can create own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);