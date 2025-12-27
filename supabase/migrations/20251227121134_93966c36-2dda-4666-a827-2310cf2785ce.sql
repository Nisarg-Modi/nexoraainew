-- Move vector extension from public to extensions schema
-- First, drop the extension from public (CASCADE will remove dependent objects)
-- Then recreate it in the extensions schema

-- Note: Supabase already has an 'extensions' schema, so we'll use that
ALTER EXTENSION vector SET SCHEMA extensions;