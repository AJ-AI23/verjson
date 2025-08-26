-- Add PIN code security to documents
ALTER TABLE public.documents 
ADD COLUMN pin_code TEXT NULL,
ADD COLUMN pin_enabled BOOLEAN NOT NULL DEFAULT false;

-- Create index for PIN lookups
CREATE INDEX idx_documents_pin_enabled ON public.documents(pin_enabled) WHERE pin_enabled = true;

-- Add comment to explain PIN storage
COMMENT ON COLUMN public.documents.pin_code IS 'Hashed 6-digit PIN code for additional document security';
COMMENT ON COLUMN public.documents.pin_enabled IS 'Whether PIN protection is enabled for this document';