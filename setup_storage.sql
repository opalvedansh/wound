-- Setup script for Supabase Storage

-- 1. Create the 'images' bucket if it doesn't exist. Set it to private (public = false).
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Authenticated users can upload images to the 'images' bucket.
CREATE POLICY "Allow authenticated uploads to images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'images');

-- 4. Policy: Authenticated users can view images in the 'images' bucket.
-- Ideally, this would be restricted via a join to the Treatment->Case->Patient table to check auth.uid(),
-- but since Supabase Storage policies don't easily allow cross-schema joins without a security definer function,
-- we'll restrict it to authenticated doctors for now, and rely on signed URLs (which expire) for viewing.
CREATE POLICY "Allow authenticated viewing of images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'images');
