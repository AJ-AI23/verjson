
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

  // Update database version only on initial document load, not during version navigation
  useEffect(() => {
    if (documentId && savedSchema && !databaseVersion) {
      // Only set initial database version if not already set
      console.log('Setting initial database version for new document');
      setDatabaseVersion(savedSchema);
    }
  }, [documentId, savedSchema, databaseVersion]);

  // Create initial version when document is loaded (only once per document)
  useEffect(() => {
    console.log('Initial version effect triggered:', { 
      documentId, 
      hasSchema: !!savedSchema && savedSchema.trim() !== '{}' && savedSchema.trim() !== '', 
      loading, 
      hasVersions: versions.length > 0,
      attemptedFor: initialVersionAttempted.current 
    });
    
    if (!documentId || !savedSchema || savedSchema.trim() === '{}' || savedSchema.trim() === '') {
      return;
    }

    // Don't create if we've already attempted for this document
    if (initialVersionAttempted.current === documentId) {
      console.log('Already attempted initial version for this document');
      return;
    }

    // Check if versions have loaded and if there's already an initial version
    if (loading) {
      console.log('Still loading versions, waiting...');
      return; // Wait for versions to load
    }

    const hasInitialVersion = versions.some(v => v.description === 'Initial version');
    console.log('Has initial version:', hasInitialVersion, 'Total versions:', versions.length);
    
    if (!hasInitialVersion) {
      try {
        const parsedSchema = JSON.parse(savedSchema);
        // Only create initial version if the schema has actual content
        if (Object.keys(parsedSchema).length > 0) {
          console.log('Creating initial version for document:', documentId);
          const initialPatch = generatePatch(
            {}, // Empty previous schema
            parsedSchema,
            { major: 0, minor: 1, patch: 0 },
            'minor',
            'Initial version',
            true // Mark as released
          );
          
          // Mark that we've attempted creation for this document
          initialVersionAttempted.current = documentId;
          createVersion(initialPatch);
          console.log('Initial version created successfully');
        }
      } catch (err) {
        console.error('Failed to create initial version:', err);
        // Still mark as attempted to prevent infinite retries
        initialVersionAttempted.current = documentId;
      }
    } else {
      console.log('Initial version already exists, marking as attempted');
      initialVersionAttempted.current = documentId;
    }
  }, [documentId, savedSchema, loading, versions, createVersion]);

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
      console.log('New schema calculated:', newSchema);
      
      setSchema(newSchemaString);
      setSavedSchema(newSchemaString);
      setDatabaseVersion(newSchemaString); // Update database version to reflect current patch state
      
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
      setDatabaseVersion(newSchemaString); // Update database version to reflect current patch state
      
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
  };
};
