-- Update handle_new_user function to remove email column reference
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  counter integer := 0;
BEGIN
  -- Get base username from metadata or email prefix
  base_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  
  -- Start with base username
  final_username := base_username;
  
  -- Keep trying with incrementing numbers until we find a unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || '_' || counter::text;
  END LOOP;

  -- Note: email column removed from profiles table - email is stored only in auth.users
  INSERT INTO public.profiles (user_id, full_name, username)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    final_username
  );
  RETURN NEW;
END;
$function$;