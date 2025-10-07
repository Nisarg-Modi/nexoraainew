-- Enable RLS on the documentation table
ALTER TABLE public._security_documentation ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read security documentation
CREATE POLICY "Anyone can read security documentation"
ON public._security_documentation
FOR SELECT
TO authenticated
USING (true);