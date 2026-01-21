
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
  formatVersion,
  validateVersionForCreation
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
  const [suggestedVersion, setSuggestedVersion] = useState<Version | null>(null);
  
  // Track the true database version separately from savedSchema
  const [databaseVersion, setDatabaseVersion] = useState<string>('');

  // Prevent post-commit patch recalculation from overwriting the editor with a stale merge
  const lastCommitRef = useRef<{ at: number; schema: string } | null>(null);
  
  // Track if we've already attempted to create initial version for this document
  const initialVersionAttempted = useRef<string | null>(null);
  
  // Use database operations for document versions
  const {
    versions,
    loading,
    createVersion,
    updateVersion,
    deleteVersion: deleteVersionFromDb,
    getSchemaPatches,
    refetch
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

  // Optimized database version calculation with debouncing
  const calculateDatabaseVersion = useCallback(async (schemaPatches: SchemaPatch[]) => {
    // Don't calculate database version if no document is loaded
    if (!documentId) {
      return;
    }
    
    if (schemaPatches.length === 0) {
      debugToast('No patches available, skipping database version calculation');
      return;
    }
    
    const safeJsonEqual = (a: string, b: string): boolean => {
      if (a === b) return true;
      try {
        return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
      } catch {
        return false;
      }
    };

    try {
      const currentMergedSchema = applySelectedPatches(schemaPatches);
      const mergedSchemaString = JSON.stringify(currentMergedSchema, null, 2);

      // If we just committed, never let a stale merge overwrite the editor.
      const recentlyCommitted =
        !!lastCommitRef.current && Date.now() - lastCommitRef.current.at < 2500;

      const mergedMatchesEditor = safeJsonEqual(schema, mergedSchemaString);

      // Keep databaseVersion accurate, but avoid regressing it immediately after commit
      // if the merge result doesn't match what the user just committed.
      if (!recentlyCommitted || mergedMatchesEditor) {
        setDatabaseVersion(mergedSchemaString);
      }

      // IMPORTANT:
      // Never overwrite the editor content from here.
      // Version commits must not trigger any editor reload/sync; editor updates happen only
      // via explicit user actions (toggle selection / manual reload) and the editor itself.
      if (!mergedMatchesEditor) {
        debugToast('DB merge differs from editor (no auto-sync)', {
          recentlyCommitted,
          mergedLength: mergedSchemaString.length,
          editorLength: schema.length,
        });
      }
    } catch (err) {
      console.error('Failed to calculate database version from patches:', err);
      debugToast('Version calculation failed', (err as Error).message);
      toast.error('Failed to apply version', {
        description: (err as Error).message,
      });
    }
  }, [documentId, debugToast, schema]);

  // Update patches when database versions change
  useEffect(() => {
    const schemaPatches = memoizedGetSchemaPatches();
    setPatches(schemaPatches);
  }, [memoizedGetSchemaPatches]);

  // Set database version when patches load or change (separated for better performance)
  useEffect(() => {
    if (patches.length > 0 && !loading) {
      debugToast('📊 Patches updated, recalculating database version', {
        patchCount: patches.length,
        selectedCount: patches.filter(p => p.isSelected).length
      });
      calculateDatabaseVersion(patches);
    }
  }, [patches, loading, calculateDatabaseVersion]);

  // Initial version creation has been moved to useDocuments.createDocument to prevent race conditions
  // This effect now only handles loading the initial version when document is opened
  useEffect(() => {
    if (!documentId || loading) {
      return;
    }

    // Mark this document as seen to prevent any legacy initial version creation attempts
    initialVersionAttempted.current = documentId;
  }, [documentId, loading]);

  // Reset tracking when document changes
  useEffect(() => {
    if (documentId && initialVersionAttempted.current !== documentId) {
      debugToast('Document changed, resetting version tracking', { documentId, previous: initialVersionAttempted.current });
      initialVersionAttempted.current = null;
      // Also reset database version when document changes
      setDatabaseVersion('');
    }
  }, [documentId]);

  const handleVersionBump = async (newVersion: Version, tier: VersionTier, description: string, isReleased: boolean = false, autoVersion: boolean = false): Promise<string | null> => {
    if (!documentId) {
      toast.error('No document selected for version creation');
      return null;
    }

    try {
      console.log('[useVersioning] handleVersionBump START', {
        documentId,
        newVersion,
        tier,
        isReleased,
        autoVersion,
        schemaLength: schema?.length,
        databaseVersionLength: databaseVersion?.length,
        savedSchemaLength: savedSchema?.length,
      });

      // Only validate version number if NOT using auto versioning
      if (!autoVersion) {
        const validation = validateVersionForCreation(patches, newVersion);
        
        if (!validation.valid) {
          // Set the suggested version for the UI to pick up
          if (validation.suggestedVersion) {
            setSuggestedVersion(validation.suggestedVersion);
          }
          
          toast.error('Invalid version number', {
            description: validation.suggestedVersion 
              ? `${validation.error}. Try version ${formatVersion(validation.suggestedVersion)} instead.`
              : validation.error,
          });
          return null;
        }
      }
      
      // Clear any previous suggested version on successful validation
      setSuggestedVersion(null);
      
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
      
      // Add autoVersion flag to the patch for the backend to handle
      const patchWithAutoVersion = {
        ...patch,
        autoVersion
      };
      
      // Save to database
      const newVersionRecord = await createVersion(patchWithAutoVersion);

      console.log('[useVersioning] handleVersionBump CREATED', {
        documentId,
        newVersionId: newVersionRecord?.id,
      });
      
      // Update saved schema and database version to current schema
      lastCommitRef.current = { at: Date.now(), schema };
      setSavedSchema(schema);
      setDatabaseVersion(schema);

      console.log('[useVersioning] handleVersionBump FINALIZE', {
        documentId,
        lastCommitAt: lastCommitRef.current?.at,
        schemaLength: schema?.length,
      });
      
      // Return the new version ID for tracking
      return newVersionRecord?.id || null;
      
    } catch (err) {
      toast.error('Failed to create version', {
        description: (err as Error).message,
      });
      return null;
    }
  };

  const handleToggleSelection = useCallback(async (patchId: string) => {
    // Don't toggle selection if no document is loaded
    if (!documentId) {
      return;
    }
    
    try {
      debugToast('🔄 handleToggleSelection called for patch', patchId);
      debugToast('🔄 Current patches', patches.map(p => ({ id: p.id, isSelected: p.isSelected, description: p.description })));
      
      const updatedPatches = togglePatchSelection(patches, patchId);
      
      // Only proceed if the patches actually changed (selection was allowed)
      if (updatedPatches === patches) {
        debugToast('🚫 Selection toggle was prevented by togglePatchSelection');
        return;
      }
      
      console.log('🔄 handleToggleSelection - Before database update:', {
        patchId,
        currentSelection: patches.find(p => p.id === patchId)?.isSelected,
        targetSelection: updatedPatches.find(p => p.id === patchId)?.isSelected
      });
      
      debugToast('✅ Selection toggle allowed, proceeding with database update');
      
      // Find the patch to update
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      if (patchToUpdate) {
        debugToast('📝 Updating database for patch', { id: patchId, newSelection: patchToUpdate.isSelected });
        console.log('🔄 About to call updateVersion with:', {
          patchId,
          newSelection: patchToUpdate.isSelected
        });
        const result = await updateVersion(patchId, { is_selected: patchToUpdate.isSelected });
        console.log('🔄 updateVersion result:', result);
        debugToast('📝 Database update result', result ? 'SUCCESS' : 'FAILED');
        
        if (!result) {
          toast.error('Failed to update version selection');
          return;
        }
        
        // Force a refetch of versions to ensure UI is in sync with database
        debugToast('🔄 Forcing version refetch to sync UI state');
        console.log('🔄 Database update successful, waiting for real-time update...');
        setTimeout(async () => {
          // The real-time subscription should handle this, but let's be extra sure
          await new Promise(resolve => setTimeout(resolve, 100));
        }, 0);
      }
      
      // Apply selected patches to get new schema and update both editor and database version
      debugToast('🔍 Recalculating schema from selected patches...');
      
      // Guard against empty patches during toggle operations
      if (updatedPatches.length === 0) {
        console.log('📝 EDITOR CHANGE from useVersioning - no patches, resetting to empty');
        debugToast('No patches available after toggle, resetting to empty schema');
        setSchema('{}');
        setSavedSchema('{}');
        setDatabaseVersion('');
        return;
      }
      
      // Use setTimeout to allow UI to update first, then calculate schema
      setTimeout(() => {
        try {
          const newSchema = applySelectedPatches(updatedPatches);
          const newSchemaString = JSON.stringify(newSchema, null, 2);
          console.log('📝 EDITOR CHANGE from useVersioning - toggle selection, length:', newSchemaString.length);
          debugToast('🔍 New schema calculated, length', newSchemaString.length);
          debugToast('🎯 Setting editor content to', newSchemaString.substring(0, 200) + '...');
          
          setSchema(newSchemaString);
          setSavedSchema(newSchemaString);
          // Update database version to reflect the current selected state
          setDatabaseVersion(newSchemaString);
        } catch (err) {
          console.error('Error applying selected patches:', err);
          toast.error('Failed to apply version changes', {
            description: (err as Error).message,
          });
        }
      }, 0);
      
      debugToast('Schema updated successfully');
    } catch (err) {
      console.error('Error in handleToggleSelection:', err);
      toast.error('Failed to toggle version selection', {
        description: (err as Error).message,
      });
    }
  }, [patches, documentId, debugToast, updateVersion, setSchema, setSavedSchema, setDatabaseVersion]);

  const handleMarkAsReleased = async (patchId: string) => {
    try {
      console.log('🏷️ handleMarkAsReleased: Starting release process', { patchId });
      
      // Find the patch being released
      const targetPatch = patches.find(p => p.id === patchId);
      if (!targetPatch) {
        toast.error('Version not found');
        return;
      }
      
      console.log('🏷️ handleMarkAsReleased: Found patch to release', { 
        patchId, 
        currentIsReleased: targetPatch.isReleased,
        description: targetPatch.description 
      });
      
      // Calculate schema up to this version's timestamp
      const schemaForRelease = applySelectedPatches(patches, targetPatch.timestamp);
      const updatedPatches = markAsReleased(patches, patchId, schemaForRelease);
      const patchToUpdate = updatedPatches.find(p => p.id === patchId);
      
      if (patchToUpdate) {
        console.log('🏷️ handleMarkAsReleased: Calling updateVersion');
        
        const result = await updateVersion(patchId, {
          is_released: true,
          full_document: schemaForRelease,
          patches: null, // Remove patches as we now store full document
        });
        
        console.log('🏷️ handleMarkAsReleased: updateVersion result', { result });
        
        if (!result) {
          toast.error('Failed to mark version as released');
          return;
        }
        
        console.log('🏷️ handleMarkAsReleased: Waiting before refetch...');
        // Wait a bit for the database to update
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🏷️ handleMarkAsReleased: Calling refetch...');
        // Manually refresh versions to ensure immediate UI update
        await refetch();
        
        console.log('🏷️ handleMarkAsReleased: Waiting for state propagation...');
        // Wait another moment for state to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('🏷️ handleMarkAsReleased: Release complete');
      }
      
      toast.success('Version marked as released');
    } catch (err) {
      console.error('🏷️ handleMarkAsReleased: Error', err);
      toast.error('Failed to mark version as released', {
        description: (err as Error).message,
      });
    }
  };

  const handleDeleteVersion = async (patchId: string) => {
    // Don't delete version if no document is loaded
    if (!documentId) {
      return;
    }
    
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
        try {
          const newSchema = applySelectedPatches(result.updatedPatches);
          const newSchemaString = JSON.stringify(newSchema, null, 2);
          console.log('📝 EDITOR CHANGE from useVersioning - recalculate after deletion, length:', newSchemaString.length);
          setSchema(newSchemaString);
          setSavedSchema(newSchemaString);
          setDatabaseVersion(newSchemaString);
        } catch (err) {
          console.error('Failed to recalculate schema after version deletion:', err);
          // Fallback to empty state if recalculation fails
          console.log('📝 EDITOR CHANGE from useVersioning - fallback to empty after failed recalculation');
          setSchema('{}');
          setSavedSchema('{}');
          setDatabaseVersion('');
        }
      } else {
        // If no versions remain, reset to empty state
        console.log('📝 EDITOR CHANGE from useVersioning - no versions remain, resetting to empty');
        setSchema('{}');
        setSavedSchema('{}');
        setDatabaseVersion('');
      }
      
      // Success toast is handled inside useDocumentVersions.deleteVersionFromDb
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
    setSuggestedVersion(null);
    initialVersionAttempted.current = null;
    setIsVersionHistoryOpen(false);
  };

  const handleImportVersion = async (
    importedSchema: any, 
    comparison: DocumentVersionComparison, 
    sourceDocumentName: string
  ) => {
    debugToast('📥 Versioning: Handling import version', { sourceDocumentName, comparison });
    
    if (!comparison || !importedSchema) {
      console.error('Invalid import data provided');
      return;
    }

    if (!documentId) {
      toast.error('No document selected for import');
      return;
    }

    try {
      // First, apply the imported schema to the editor
      const importedSchemaString = JSON.stringify(importedSchema, null, 2);
      console.log('📝 EDITOR CHANGE from useVersioning - importing version, length:', importedSchemaString.length);
      setSchema(importedSchemaString);
      
      // Create a new version with the imported schema
      const importDescription = `Imported from "${sourceDocumentName}" (${comparison.recommendedVersionTier} update)`;
      const currentLatestVersion = calculateLatestVersion(patches);
      const newVersion = {
        major: comparison.recommendedVersionTier === 'major' ? currentLatestVersion.major + 1 : currentLatestVersion.major,
        minor: comparison.recommendedVersionTier === 'minor' ? currentLatestVersion.minor + 1 : currentLatestVersion.minor,
        patch: comparison.recommendedVersionTier === 'patch' ? currentLatestVersion.patch + 1 : currentLatestVersion.patch
      };
      
      // Use current schema as the baseline for patches to capture import changes
      const parsedPreviousSchema = schema ? JSON.parse(schema) : {};
      
      // Generate patch from current schema to imported schema
      const patch = generatePatch(
        parsedPreviousSchema, 
        importedSchema, 
        newVersion, 
        comparison.recommendedVersionTier, 
        importDescription,
        false
      );
      
      // Save to database
      const createdVersion = await createVersion(patch);
      
      if (createdVersion) {
        // Update saved schema and database version to imported schema
        setSavedSchema(importedSchemaString);
        setDatabaseVersion(importedSchemaString);
        
        toast.success(`Import completed: ${formatVersion(newVersion)}`, {
          description: importDescription,
        });
      }
      
    } catch (err) {
      toast.error('Failed to import version', {
        description: (err as Error).message,
      });
    }
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
    suggestedVersion,
  };
};
