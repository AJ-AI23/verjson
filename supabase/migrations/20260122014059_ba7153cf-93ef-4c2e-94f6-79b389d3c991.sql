-- Create storage bucket for markdown PDF renders
INSERT INTO storage.buckets (id, name, public)
VALUES ('markdown-renders', 'markdown-renders', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for markdown renders
CREATE POLICY "Anyone can view markdown renders"
ON storage.objects FOR SELECT
USING (bucket_id = 'markdown-renders');

CREATE POLICY "Authenticated users can upload markdown renders"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'markdown-renders' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own markdown renders"
ON storage.objects FOR UPDATE
USING (bucket_id = 'markdown-renders' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own markdown renders"
ON storage.objects FOR DELETE
USING (bucket_id = 'markdown-renders' AND auth.uid()::text = (storage.foldername(name))[1]);