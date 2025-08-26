
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
  revertToVersion,
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
    if (storedPatches.length > 0) {
      setPatches(storedPatches);
      toast.info(`Loaded ${storedPatches.length} version entries`);
    }
  }, []);

  const handleVersionBump = (newVersion: Version, tier: VersionTier, description: string) => {
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
        description
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

  const handleRevertToVersion = (targetPatch: SchemaPatch) => { // Accept SchemaPatch directly
    console.log('handleRevertToVersion called with patch:', targetPatch);
    try {
      // Parse the current schema
      const parsedCurrentSchema = JSON.parse(schema);
      console.log('Current schema parsed successfully');
      
      // Apply the reverse patches to get back to the target version
      const revertedSchema = revertToVersion(parsedCurrentSchema, patches, targetPatch);
      console.log('Reverted schema calculated:', revertedSchema);
      
      // Update the schema with the reverted one
      const revertedSchemaString = JSON.stringify(revertedSchema, null, 2);
      setSchema(revertedSchemaString);
      setSavedSchema(revertedSchemaString);
      console.log('Schema and savedSchema updated');
      
      toast.success(`Reverted to version ${formatVersion(targetPatch.version)}`);
    } catch (err) {
      console.error('Error in handleRevertToVersion:', err);
      toast.error('Failed to revert version', {
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
    handleRevertToVersion,
    toggleVersionHistory
  };
};
