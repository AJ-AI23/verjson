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
  // JSONEditor can emit a delayed "change" event after update()/setText().
  // Keep the internal-change flag true a bit longer so those events don't get
  // treated as user edits (which would create extra Yjs undo items).
  const clearInternalChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update editor content when the value prop changes
  useEffect(() => {
    if (!editorRef.current || value === previousValueRef.current) return;

    if (clearInternalChangeTimerRef.current) {
      clearTimeout(clearInternalChangeTimerRef.current);
      clearInternalChangeTimerRef.current = null;
    }

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
      clearInternalChangeTimerRef.current = setTimeout(() => {
        isInternalChange.current = false;
      }, 250);
    }

    return () => {
      if (clearInternalChangeTimerRef.current) {
        clearTimeout(clearInternalChangeTimerRef.current);
        clearInternalChangeTimerRef.current = null;
      }
    };
  }, [value, editorRef, isInternalChange, previousValueRef, onChange]);

  return {};
};
