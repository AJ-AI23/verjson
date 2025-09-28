-- Add is_public column to documents table
ALTER TABLE public.documents 
ADD COLUMN is_public boolean NOT NULL DEFAULT false;