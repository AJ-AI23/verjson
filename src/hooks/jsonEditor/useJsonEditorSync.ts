
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
          // Check if value is valid JSON and non-empty
          if (value && value.trim() !== '') {
            const parsedValue = JSON.parse(value);
            editorRef.current.set(parsedValue);
          } else {
            // Set empty object if value is empty
            editorRef.current.set({});
          }
        } catch (e) {
          // If parsing fails, just show the raw text
          editorRef.current.setText(value || '');
          console.error('Error updating JSONEditor:', e);
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

    // Add a handler for editor changes to propagate back to parent
    useEffect(() => {
      if (!editorRef.current) return;
      
      const handleChange = () => {
        if (isInternalChange.current || !editorRef.current) return;
        
        try {
          const json = editorRef.current.get();
          const jsonStr = JSON.stringify(json, null, 2);
          
          if (jsonStr !== previousValueRef.current) {
            onChange(jsonStr);
            previousValueRef.current = jsonStr;
          }
        } catch (err) {
          console.error('Error getting JSON from editor:', err);
        }
      };
      
      // Try to attach the onChange handler
      if (editorRef.current.options) {
        editorRef.current.options.onChange = handleChange;
      }
      
      return () => {
        if (editorRef.current && editorRef.current.options) {
          editorRef.current.options.onChange = undefined;
        }
      };
    }, [editorRef.current, onChange]);
  };

  return { syncEditorWithProps };
};
