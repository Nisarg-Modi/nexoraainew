-- Enable pgcrypto extension in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Update hash_identifier function to use extensions schema
CREATE OR REPLACE FUNCTION public.hash_identifier(identifier_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use SHA-256 to hash the identifier from extensions schema
  RETURN encode(extensions.digest(identifier_text, 'sha256'), 'hex');
END;
$function$;