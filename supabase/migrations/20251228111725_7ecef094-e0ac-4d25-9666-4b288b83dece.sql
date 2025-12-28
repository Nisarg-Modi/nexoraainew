-- Create storage bucket for stream media
INSERT INTO storage.buckets (id, name, public)
VALUES ('stream-media', 'stream-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to stream-media bucket
CREATE POLICY "Stream owners can upload media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'stream-media' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to stream media
CREATE POLICY "Anyone can view stream media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'stream-media');

-- Allow stream owners to delete their media
CREATE POLICY "Stream owners can delete their media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'stream-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);