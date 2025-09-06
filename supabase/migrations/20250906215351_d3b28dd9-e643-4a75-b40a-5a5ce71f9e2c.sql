-- Allow the create_invitation_notification function to insert notifications
CREATE POLICY "System can create invitation notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Also allow service role to create notifications directly
CREATE POLICY "Service role can create notifications" 
ON public.notifications 
FOR INSERT 
TO service_role
WITH CHECK (true);