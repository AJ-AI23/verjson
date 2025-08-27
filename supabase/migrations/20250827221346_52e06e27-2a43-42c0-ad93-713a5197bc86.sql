-- Create editor_history table for server-side history storage
CREATE TABLE public.editor_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  sequence_number integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.editor_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own editor history" 
ON public.editor_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own editor history" 
ON public.editor_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own editor history" 
ON public.editor_history 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own editor history" 
ON public.editor_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to generate content hash
CREATE OR REPLACE FUNCTION public.generate_content_hash(content text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(content, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_editor_history_updated_at
  BEFORE UPDATE ON public.editor_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_editor_history_document_user ON public.editor_history(document_id, user_id);
CREATE INDEX idx_editor_history_sequence ON public.editor_history(document_id, user_id, sequence_number);
CREATE INDEX idx_editor_history_created_at ON public.editor_history(created_at);

-- Create function to clean up old history entries
CREATE OR REPLACE FUNCTION public.cleanup_old_editor_history()
RETURNS void AS $$
BEGIN
  -- Keep only the latest 100 entries per document/user combination
  DELETE FROM public.editor_history 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY document_id, user_id 
        ORDER BY sequence_number DESC
      ) as rn
      FROM public.editor_history
    ) ranked
    WHERE rn <= 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically cleanup old entries
CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run cleanup occasionally to avoid performance issues
  IF random() < 0.1 THEN -- 10% chance
    PERFORM public.cleanup_old_editor_history();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_old_editor_history_trigger
  AFTER INSERT ON public.editor_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cleanup_old_history();