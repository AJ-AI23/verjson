
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { DocumentVersionComparison } from '@/lib/importVersionUtils';
import { useDebug } from '@/contexts/DebugContext';

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
  const { debugToast } = useDebug();
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
  
  // Memoized current version calculation to prevent recalculation on every render
  const currentVersion = useMemo(() => {
    return calculateLatestVersion(patches);
  }, [patches]);

  // Move debug logging to useEffect to avoid render-phase side effects
  useEffect(() => {
    debugToast('Version Debug', {
      isModified,
      schemaLength: schema?.length,
      databaseVersionLength: databaseVersion?.length,
      documentId,
      schemaHash: schema?.substring(0, 100),
      databaseVersionHash: databaseVersion?.substring(0, 100)
    });
  }, [isModified, schema, databaseVersion, documentId]);

  // Memoized function to get schema patches
  const memoizedGetSchemaPatches = useCallback(() => {
    return getSchemaPatches();
  }, [getSchemaPatches]);

  // Debounced database version calculation to prevent excessive updates
  const calculateDatabaseVersion = useCallback((schemaPatches: SchemaPatch[]) => {
    if (schemaPatches.length === 0) return;
    
    try {
      const currentMergedSchema = applySelectedPatches(schemaPatches);
      const mergedSchemaString = JSON.stringify(currentMergedSchema, null, 2);
      setDatabaseVersion(mergedSchemaString);
      debugToast('Database version set from selected patches', mergedSchemaString.substring(0, 100));
    } catch (err) {
      console.error('Failed to calculate database version from patches:', err);
    }
  }, []);

  // Update patches when database versions change
  useEffect(() => {
    const schemaPatches = memoizedGetSchemaPatches();
    setPatches(schemaPatches);
  }, [memoizedGetSchemaPatches]);

  // Set database version when patches load or change (separated for better performance)
  useEffect(() => {
    if (patches.length > 0 && !loading) {
      calculateDatabaseVersion(patches);
    }
  }, [patches, loading, calculateDatabaseVersion]);

  // Create initial version when document is loaded (only once per document)
  useEffect(() => {
    // Use saved schema for initial version creation (the one loaded from document)
    const currentSchemaToUse = savedSchema;
    
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
          debugToast('Initial version already exists in database, skipping creation');
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
  }, [documentId, loading, versions.length, savedSchema]); // Use savedSchema for initial version

  // Reset tracking when document changes
  useEffect(() => {
    if (documentId && initialVersionAttempted.current !== documentId) {
      debugToast('Document changed, resetting version tracking', { documentId, previous: initialVersionAttempted.current });
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
      
      // Use database version as the baseline for patches (the merged state of selected versions)
      const parsedPreviousSchema = databaseVersion ? JSON.parse(databaseVersion) : {};
      
      // Generate patch from database version to current schema
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
      
      // Update saved schema and database version to current schema
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
      debugToast('🔄 handleToggleSelection called for patch', patchId);
      debugToast('🔄 Current patches', patches.map(p => ({ id: p.id, isSelected: p.isSelected, description: p.description })));
      
      const updatedPatches = togglePatchSelection(patches, patchId);
      
      // Only proceed if the patches actually changed (selection was allowed)
      if (updatedPatches === patches) {
        debugToast('🚫 Selection toggle was prevented by togglePatchSelection');
        return;
      }
      
      debugToast('✅ Selection toggle allowed, proceeding with database update');
      
      // Find the patch to update
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      if (patchToUpdate) {
        debugToast('📝 Updating database for patch', { id: patchId, newSelection: patchToUpdate.isSelected });
        const result = await updateVersion(patchId, { is_selected: patchToUpdate.isSelected });
        debugToast('📝 Database update result', result ? 'SUCCESS' : 'FAILED');
        
        if (!result) {
          toast.error('Failed to update version selection');
          return;
        }
      }
      
      // Apply selected patches to get new schema and update both editor and database version
      debugToast('🔍 Recalculating schema from selected patches...');
      const newSchema = applySelectedPatches(updatedPatches);
      const newSchemaString = JSON.stringify(newSchema, null, 2);
      debugToast('🔍 New schema calculated, length', newSchemaString.length);
      debugToast('🎯 Setting editor content to', newSchemaString.substring(0, 200) + '...');
      
      setSchema(newSchemaString);
      setSavedSchema(newSchemaString);
      // Update database version to reflect the current selected state
      setDatabaseVersion(newSchemaString);
      
      debugToast('Schema updated successfully');
    } catch (err) {
      console.error('Error in handleToggleSelection:', err);
      toast.error('Failed to toggle version selection', {
        description: (err as Error).message,
      });
    }
  };

  const handleMarkAsReleased = async (patchId: string) => {
    try {
      // Find the patch being released
      const targetPatch = patches.find(p => p.id === patchId);
      if (!targetPatch) {
        toast.error('Version not found');
        return;
      }
      
      // Calculate schema up to this version's timestamp
      const schemaForRelease = applySelectedPatches(patches, targetPatch.timestamp);
      const updatedPatches = markAsReleased(patches, patchId, schemaForRelease);
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      
      if (patchToUpdate) {
        await updateVersion(patchId, {
          is_released: true,
          full_document: schemaForRelease,
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
      if (result.updatedPatches.length > 0) {
        const newSchema = applySelectedPatches(result.updatedPatches);
        const newSchemaString = JSON.stringify(newSchema, null, 2);
        setSchema(newSchemaString);
        setSavedSchema(newSchemaString);
        setDatabaseVersion(newSchemaString);
      } else {
        // If no versions remain, reset to empty state
        setSchema('{}');
        setSavedSchema('{}');
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
    debugToast('🧹 Versioning: Clearing all version state');
    setPatches([]);
    setDatabaseVersion('');
    initialVersionAttempted.current = null;
    setIsVersionHistoryOpen(false);
  };

  const handleImportVersion = (
    importedSchema: any, 
    comparison: DocumentVersionComparison, 
    sourceDocumentName: string
  ) => {
    debugToast('📥 Versioning: Handling import version', { sourceDocumentName, comparison });
    
    if (!comparison || !importedSchema) {
      console.error('Invalid import data provided');
      return;
    }

    // Create a new version with the imported schema
    const importDescription = `Imported from "${sourceDocumentName}" (${comparison.recommendedVersionTier} update)`;
    const currentLatestVersion = calculateLatestVersion(patches);
    const newVersion = {
      major: comparison.recommendedVersionTier === 'major' ? currentLatestVersion.major + 1 : currentLatestVersion.major,
      minor: comparison.recommendedVersionTier === 'minor' ? currentLatestVersion.minor + 1 : currentLatestVersion.minor,
      patch: comparison.recommendedVersionTier === 'patch' ? currentLatestVersion.patch + 1 : currentLatestVersion.patch
    };
    
    handleVersionBump(newVersion, comparison.recommendedVersionTier, importDescription, false);
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
    loading,
    clearVersionState,
    handleImportVersion,
  };
};
