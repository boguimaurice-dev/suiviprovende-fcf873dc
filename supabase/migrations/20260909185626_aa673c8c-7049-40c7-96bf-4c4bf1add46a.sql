UPDATE public.app_data SET data = '{}'::jsonb
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'poulaillerdumonastere@gmail.com'
);