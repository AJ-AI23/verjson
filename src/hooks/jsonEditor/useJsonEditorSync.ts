
import { useEffect } from 'react';
import JSONEditor from 'jsoneditor';

interface UseJsonEditorSyncProps {
  editorRef: React.MutableRefObject<JSONEditor | null>;
  isInternalChange: React.MutableRefObject<boolean>;
  previousValueRef: React.MutableRefObject<string>;
  value: string;
  onChange: (value: string) => void;
}

export const useJsonEditorSync = ({
  editorRef,
  isInternalChange,
  previousValueRef,
  value,
  onChange
}: UseJsonEditorSyncProps) => {
  // Update editor content when the value prop changes
  const syncEditorWithProps = () => {
    useEffect(() => {
      if (!editorRef.current || value === previousValueRef.current) return;

      try {
        // Set flag to prevent onChange from triggering
        isInternalChange.current = true;
        
        // Update editor content
        try {
          editorRef.current.update(JSON.parse(value));
        } catch (e) {
          // If parsing fails, just show the raw text
          editorRef.current.setText(value);
        }
        
        // Update previous value
        previousValueRef.current = value;
      } catch (err) {
        console.error('Error updating JSONEditor:', err);
      } finally {
        // Clear flag after a short delay
        setTimeout(() => {
          isInternalChange.current = false;
        }, 0);
      }
    }, [value]);
  };

  return { syncEditorWithProps };
};
