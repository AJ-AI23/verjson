-- Add foreign key constraint from profiles to auth.users
-- This ensures every profile has a corresponding authenticated user

ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;