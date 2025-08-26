
import { useState, useEffect } from 'react';
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
  
  // Use database operations for document versions
  const {
    versions,
    loading,
    createVersion,
    updateVersion,
    deleteVersion: deleteVersionFromDb,
    getSchemaPatches
  } = useDocumentVersions(documentId);

  // Calculate if the schema has been modified since last save
  const isModified = schema !== savedSchema;
  
  // Get the current version based on patches
  const currentVersion = calculateLatestVersion(patches);

  // Update patches when database versions change
  useEffect(() => {
    const schemaPatches = getSchemaPatches();
    setPatches(schemaPatches);
  }, [versions, getSchemaPatches]);

  // Load or create initial version when document is loaded
  useEffect(() => {
    if (!documentId || !savedSchema || savedSchema.trim() === '{}' || savedSchema.trim() === '') {
      return;
    }

    // Check if we need to create an initial version
    const hasInitialVersion = patches.some(p => p.description === 'Initial version');
    
    if (!hasInitialVersion) {
      try {
        const parsedSchema = JSON.parse(savedSchema);
        // Only create initial version if the schema has actual content
        if (Object.keys(parsedSchema).length > 0) {
          console.log('Creating initial version with schema:', parsedSchema);
          const initialPatch = generatePatch(
            {}, // Empty previous schema
            parsedSchema,
            { major: 0, minor: 1, patch: 0 },
            'minor',
            'Initial version',
            true // Mark as released
          );
          
          console.log('Created initial patch:', initialPatch);
          createVersion(initialPatch);
          toast.info('Created initial version v0.1.0');
        }
      } catch (err) {
        console.error('Failed to create initial version:', err);
      }
    } else if (patches.length > 0) {
      console.log(`Loaded ${patches.length} version entries from database`);
    }
  }, [documentId, savedSchema, patches.length, createVersion]);

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
      
      // Update saved schema
      setSavedSchema(schema);
      
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
