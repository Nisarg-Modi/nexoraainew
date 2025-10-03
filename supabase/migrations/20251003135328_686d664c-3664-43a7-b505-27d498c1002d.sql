-- Fix the hash_identifier function to use proper type casting
CREATE OR REPLACE FUNCTION public.hash_identifier(identifier_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use SHA-256 to hash the identifier with explicit type cast
  RETURN encode(digest(identifier_text, 'sha256'::text), 'hex');
END;
$function$;