
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Version,
  VersionTier,
  SchemaPatch,
  generatePatch,
  loadPatches,
  savePatches,
  calculateLatestVersion,
  applySelectedPatches,
  togglePatchSelection,
  markAsReleased,
  deleteVersion,
  formatVersion
} from '@/lib/versionUtils';

interface UseVersioningProps {
  schema: string;
  savedSchema: string;
  setSavedSchema: (schema: string) => void;
  setSchema: (schema: string) => void;
}

export const useVersioning = ({ 
  schema, 
  savedSchema, 
  setSavedSchema, 
  setSchema 
}: UseVersioningProps) => {
  const [patches, setPatches] = useState<SchemaPatch[]>([]);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  // Calculate if the schema has been modified since last save
  const isModified = schema !== savedSchema;
  
  // Get the current version based on patches
  const currentVersion = calculateLatestVersion(patches);

  // Load patches from localStorage on component mount
  useEffect(() => {
    const storedPatches = loadPatches();
    
    // Check if we need to create an initial released version
    const hasInitialVersion = storedPatches.some(p => p.description === 'Initial version');
    
    if (!hasInitialVersion && savedSchema) {
      try {
        const parsedSchema = JSON.parse(savedSchema);
        const initialPatch = generatePatch(
          {}, // Empty previous schema
          parsedSchema,
          { major: 0, minor: 1, patch: 0 },
          'minor',
          'Initial version',
          true // Mark as released
        );
        
        const updatedPatches = [initialPatch, ...storedPatches];
        setPatches(updatedPatches);
        savePatches(updatedPatches);
        
        if (storedPatches.length === 0) {
          toast.info('Created initial version v0.1.0');
        } else {
          toast.info(`Loaded ${storedPatches.length} versions + initial version`);
        }
      } catch (err) {
        console.error('Failed to create initial version:', err);
        if (storedPatches.length > 0) {
          setPatches(storedPatches);
          toast.info(`Loaded ${storedPatches.length} version entries`);
        }
      }
    } else if (storedPatches.length > 0) {
      setPatches(storedPatches);
      toast.info(`Loaded ${storedPatches.length} version entries`);
    }
  }, [savedSchema]);

  const handleVersionBump = (newVersion: Version, tier: VersionTier, description: string, isReleased: boolean = false) => {
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
      
      // Update patches
      const updatedPatches = [...patches, patch];
      setPatches(updatedPatches);
      
      // Save patches to localStorage
      savePatches(updatedPatches);
      
      // Update saved schema
      setSavedSchema(schema);
      
    } catch (err) {
      toast.error('Failed to create version', {
        description: (err as Error).message,
      });
    }
  };

  const handleToggleSelection = (patchId: string) => {
    try {
      const updatedPatches = togglePatchSelection(patches, patchId);
      setPatches(updatedPatches);
      savePatches(updatedPatches);
      
      // Apply selected patches to get new schema
      const newSchema = applySelectedPatches(updatedPatches);
      const newSchemaString = JSON.stringify(newSchema, null, 2);
      setSchema(newSchemaString);
      setSavedSchema(newSchemaString);
      
    } catch (err) {
      toast.error('Failed to toggle version selection', {
        description: (err as Error).message,
      });
    }
  };

  const handleMarkAsReleased = (patchId: string) => {
    try {
      const parsedCurrentSchema = JSON.parse(schema);
      const updatedPatches = markAsReleased(patches, patchId, parsedCurrentSchema);
      setPatches(updatedPatches);
      savePatches(updatedPatches);
      
      toast.success('Version marked as released');
    } catch (err) {
      toast.error('Failed to mark version as released', {
        description: (err as Error).message,
      });
    }
  };

  const handleDeleteVersion = (patchId: string) => {
    try {
      const result = deleteVersion(patches, patchId);
      
      if (!result.success) {
        toast.error('Cannot delete version', {
          description: result.error,
        });
        return;
      }
      
      setPatches(result.updatedPatches);
      savePatches(result.updatedPatches);
      
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
    toggleVersionHistory
  };
};
