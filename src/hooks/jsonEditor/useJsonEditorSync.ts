import { useEffect, useRef } from 'react';
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
  // Track the value we just pushed to the editor to ignore its echo
  const lastPushedValueRef = useRef<string | null>(null);
  const echoWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update editor content when the value prop changes
  useEffect(() => {
    if (!editorRef.current || value === previousValueRef.current) return;

    // Clear any previous echo window
    if (echoWindowRef.current) {
      clearTimeout(echoWindowRef.current);
      echoWindowRef.current = null;
    }

    try {
      // Mark that we're about to push this value - any change event
      // returning this exact value within a short window is an echo
      lastPushedValueRef.current = value;
      isInternalChange.current = true;

      // Update editor content
      try {
        editorRef.current.update(JSON.parse(value));
      } catch {
        // If parsing fails, just show the raw text
        editorRef.current.setText(value);
      }

      // Update previous value
      previousValueRef.current = value;
    } catch (err) {
      console.error('Error updating JSONEditor:', err);
    } finally {
      // Reset internal change flag immediately so new user edits are captured
      isInternalChange.current = false;
      
      // Keep the echo detection active for a short window
      echoWindowRef.current = setTimeout(() => {
        lastPushedValueRef.current = null;
      }, 300);
    }

    return () => {
      if (echoWindowRef.current) {
        clearTimeout(echoWindowRef.current);
        echoWindowRef.current = null;
      }
    };
  }, [value, editorRef, isInternalChange, previousValueRef, onChange]);

  return { lastPushedValueRef };
};
