
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
      console.log('Syncing editor with props value');

      try {
        // Set flag to prevent onChange from triggering
        isInternalChange.current = true;
        
        // Update editor content with a delay to prevent DOM manipulation issues
        const timer = setTimeout(() => {
          if (!editorRef.current) return;
          
          try {
            // Check if value is valid JSON and non-empty
            if (value && value.trim() !== '') {
              const parsedValue = JSON.parse(value);
              editorRef.current.set(parsedValue);
              console.log('Editor content updated from props');
            } else {
              // Set empty object if value is empty
              editorRef.current.set({});
              console.log('Set empty object in editor');
            }
          } catch (e) {
            console.error('Error updating JSONEditor:', e);
            // We don't attempt to set text since that's causing DOM errors
            // Just set an empty object as fallback
            try {
              if (editorRef.current) {
                editorRef.current.set({});
                console.log('Set empty object as fallback after error');
              }
            } catch (fallbackErr) {
              console.error('Even fallback failed:', fallbackErr);
            }
          }
          
          // Update previous value
          previousValueRef.current = value;
          
          // Clear flag after updating
          isInternalChange.current = false;
        }, 150); // Increased timeout for more reliability
        
        return () => clearTimeout(timer);
      } catch (err) {
        console.error('Error in sync effect:', err);
        isInternalChange.current = false;
      }
    }, [value]);

    // Add a handler for editor changes to propagate back to parent
    useEffect(() => {
      if (!editorRef.current) return;
      
      // Define the handler in a variable to avoid re-creation on each render
      const handleChange = () => {
        // If this is an internal change, ignore it
        if (isInternalChange.current || !editorRef.current) return;
        
        try {
          const json = editorRef.current.get();
          const jsonStr = JSON.stringify(json, null, 2);
          
          if (jsonStr !== previousValueRef.current) {
            onChange(jsonStr);
            previousValueRef.current = jsonStr;
            console.log('Updated value from editor change');
          }
        } catch (err) {
          console.error('Error getting JSON from editor:', err);
        }
      };
      
      // Try to attach the onChange handler
      if (editorRef.current.options) {
        editorRef.current.options.onChange = handleChange;
        console.log('Attached change handler to editor');
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
