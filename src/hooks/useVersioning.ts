
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Version,
  VersionTier,
  SchemaPatch,
  generatePatch,
  calculateLatestVersion,
  applySelectedPatches,
  togglePatchSelection,
  markAsReleased,
  deleteVersion,
  formatVersion
} from '@/lib/versionUtils';
import { useDocumentVersions } from '@/hooks/useDocumentVersions';
import { supabase } from '@/integrations/supabase/client';

interface UseVersioningProps {
  schema: string;
  savedSchema: string;
  setSavedSchema: (schema: string) => void;
  setSchema: (schema: string) => void;
  documentId?: string;
}

export const useVersioning = ({ 
  schema, 
  savedSchema, 
  setSavedSchema, 
  setSchema,
  documentId
}: UseVersioningProps) => {
  const [patches, setPatches] = useState<SchemaPatch[]>([]);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  
  // Track the true database version separately from savedSchema
  const [databaseVersion, setDatabaseVersion] = useState<string>('');
  
  // Track if we've already attempted to create initial version for this document
  const initialVersionAttempted = useRef<string | null>(null);
  
  // Use database operations for document versions
  const {
    versions,
    loading,
    createVersion,
    updateVersion,
    deleteVersion: deleteVersionFromDb,
    getSchemaPatches
  } = useDocumentVersions(documentId);

  // Calculate if the schema has been modified since last database commit
  const isModified = schema !== databaseVersion;
  
  // Debug logging for isModified calculation
  console.log('Version Debug:', {
    isModified,
    schemaLength: schema?.length,
    databaseVersionLength: databaseVersion?.length,
    documentId,
    schemaHash: schema?.substring(0, 100),
    databaseVersionHash: databaseVersion?.substring(0, 100)
  });
  
  // Get the current version based on patches
  const currentVersion = calculateLatestVersion(patches);

  // Update patches when database versions change
  useEffect(() => {
    const schemaPatches = getSchemaPatches();
    setPatches(schemaPatches);
  }, [versions, getSchemaPatches]);

  // Only set database version after successful commits, not on initial load

  // Create initial version when document is loaded (only once per document)
  useEffect(() => {
    // Use current schema instead of savedSchema for initial version creation
    const currentSchemaToUse = schema || savedSchema;
    
    // Early returns to prevent unnecessary processing
    if (!documentId || !currentSchemaToUse || currentSchemaToUse.trim() === '{}' || currentSchemaToUse.trim() === '') {
      return;
    }

    // Check if versions have loaded
    if (loading) {
      return; // Wait for versions to load
    }

    // Don't create if we've already attempted for this document
    if (initialVersionAttempted.current === documentId) {
      return;
    }

    // Check if any version already exists (not just initial version)
    if (versions.length > 0) {
      initialVersionAttempted.current = documentId;
      return;
    }
    
    // Only create if no versions exist at all - with additional database check
    const createInitialVersion = async () => {
      try {
        // Mark attempt immediately to prevent concurrent creation
        initialVersionAttempted.current = documentId;
        
        // Double-check database to ensure no versions exist before creating
        const { data: existingVersions } = await supabase
          .from('document_versions')
          .select('id')
          .eq('document_id', documentId)
          .limit(1);
          
        if (existingVersions && existingVersions.length > 0) {
          console.log('Initial version already exists in database, skipping creation');
          return;
        }
        
        const parsedSchema = JSON.parse(currentSchemaToUse);
        // Only create initial version if the schema has actual content
        if (Object.keys(parsedSchema).length > 0) {
          const initialPatch = generatePatch(
            {}, // Empty previous schema
            parsedSchema,
            { major: 0, minor: 1, patch: 0 },
            'minor',
            'Initial version',
            true // Mark as released
          );
          
          const result = await createVersion(initialPatch);
          if (result) {
            setDatabaseVersion(currentSchemaToUse);
          } else {
            // Reset attempt tracking if creation failed
            initialVersionAttempted.current = null;
          }
        }
      } catch (err) {
        console.error('Failed to create initial version:', err);
        // Reset attempt tracking if creation failed
        initialVersionAttempted.current = null;
      }
    };
    
    createInitialVersion();
  }, [documentId, loading, versions.length]); // Remove schema dependencies to prevent loops

  // Reset tracking when document changes
  useEffect(() => {
    if (documentId && initialVersionAttempted.current !== documentId) {
      console.log('Document changed, resetting version tracking:', { documentId, previous: initialVersionAttempted.current });
      initialVersionAttempted.current = null;
      // Also reset database version when document changes
      setDatabaseVersion('');
    }
  }, [documentId]);

  const handleVersionBump = async (newVersion: Version, tier: VersionTier, description: string, isReleased: boolean = false) => {
    if (!documentId) {
      toast.error('No document selected for version creation');
      return;
    }

    try {
      // Ensure the current schema is valid
      const parsedCurrentSchema = JSON.parse(schema);
      const parsedPreviousSchema = JSON.parse(savedSchema);
      
      // Generate patch
      const patch = generatePatch(
        parsedPreviousSchema, 
        parsedCurrentSchema, 
        newVersion, 
        tier, 
        description,
        isReleased
      );
      
      // Save to database
      await createVersion(patch);
      
      // Update both saved schema and database version
      setSavedSchema(schema);
      setDatabaseVersion(schema);
      
    } catch (err) {
      toast.error('Failed to create version', {
        description: (err as Error).message,
      });
    }
  };

  const handleToggleSelection = async (patchId: string) => {
    try {
      console.log('Toggling selection for patch:', patchId);
      const updatedPatches = togglePatchSelection(patches, patchId);
      
      // Only proceed if the patches actually changed (selection was allowed)
      if (updatedPatches === patches) {
        console.log('Selection toggle was prevented');
        return;
      }
      
      // Find the patch to update
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      if (patchToUpdate) {
        await updateVersion(patchId, { is_selected: patchToUpdate.isSelected });
      }
      
      // Apply selected patches to get new schema
      console.log('Recalculating schema from selected patches...');
      const newSchema = applySelectedPatches(updatedPatches);
      const newSchemaString = JSON.stringify(newSchema, null, 2);
      console.log('New schema calculated, length:', newSchemaString.length);
      console.log('Setting editor content to:', newSchemaString.substring(0, 200) + '...');
      
      setSchema(newSchemaString);
      setSavedSchema(newSchemaString);
      // Don't update databaseVersion here - it should only reflect actually committed versions
      
      console.log('Schema updated successfully');
    } catch (err) {
      console.error('Error in handleToggleSelection:', err);
      toast.error('Failed to toggle version selection', {
        description: (err as Error).message,
      });
    }
  };

  const handleMarkAsReleased = async (patchId: string) => {
    try {
      const parsedCurrentSchema = JSON.parse(schema);
      const updatedPatches = markAsReleased(patches, patchId, parsedCurrentSchema);
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      
      if (patchToUpdate) {
        await updateVersion(patchId, {
          is_released: true,
          full_document: parsedCurrentSchema,
          patches: null, // Remove patches as we now store full document
        });
      }
      
      toast.success('Version marked as released');
    } catch (err) {
      toast.error('Failed to mark version as released', {
        description: (err as Error).message,
      });
    }
  };

  const handleDeleteVersion = async (patchId: string) => {
    try {
      const result = deleteVersion(patches, patchId);
      
      if (!result.success) {
        toast.error('Cannot delete version', {
          description: result.error,
        });
        return;
      }
      
      // Delete from database
      const success = await deleteVersionFromDb(patchId);
      if (!success) {
        return; // Error already handled in useDocumentVersions
      }
      
      // Recalculate schema after deletion
      const newSchema = applySelectedPatches(result.updatedPatches);
      const newSchemaString = JSON.stringify(newSchema, null, 2);
      setSchema(newSchemaString);
      setSavedSchema(newSchemaString);
      
      // If no versions remain, reset database version to allow new commits
      if (result.updatedPatches.length === 0) {
        setDatabaseVersion('');
      }
      
      toast.success('Version deleted successfully');
    } catch (err) {
      toast.error('Failed to delete version', {
        description: (err as Error).message,
      });
    }
  };

  const toggleVersionHistory = (isOpen?: boolean) => {
    setIsVersionHistoryOpen(isOpen !== undefined ? isOpen : !isVersionHistoryOpen);
  };

  // Clear all version state when document is deleted
  const clearVersionState = () => {
    console.log('🧹 Versioning: Clearing all version state');
    setPatches([]);
    setDatabaseVersion('');
    initialVersionAttempted.current = null;
    setIsVersionHistoryOpen(false);
  };

  return {
    patches,
    isVersionHistoryOpen,
    isModified,
    currentVersion,
    handleVersionBump,
    handleToggleSelection,
    handleMarkAsReleased,
    handleDeleteVersion,
    toggleVersionHistory,
    loading, // Add loading state from database operations
    clearVersionState,
  };
};
