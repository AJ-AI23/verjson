import { compare, applyPatch, Operation } from 'fast-json-patch';
import { toast } from 'sonner';

export type VersionTier = 'major' | 'minor' | 'patch';

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface VersionedSchema {
  version: Version;
  schema: any;
}

export interface SchemaPatch {
  id: string;
  timestamp: number;
  version: Version;
  description: string;
  patches?: Operation[]; // Optional for released versions
  tier: VersionTier;
  isReleased?: boolean; // Whether this version stores full document
  fullDocument?: any; // Full document for released versions
  isSelected?: boolean; // Whether this version is currently applied
  status?: string; // Version status (visible, pending, etc.)
}

// Format version as string (e.g., "1.0.0")
export const formatVersion = (version: Version): string => {
  return `${version.major}.${version.minor}.${version.patch}`;
};

// Parse version string into Version object
export const parseVersion = (versionStr: string): Version => {
  const [major = 0, minor = 0, patch = 0] = versionStr.split('.').map(Number);
  return { major, minor, patch };
};

// Bump version based on tier
export const bumpVersion = (version: Version, tier: VersionTier): Version => {
  const newVersion = { ...version };
  
  switch (tier) {
    case 'major':
      newVersion.major += 1;
      newVersion.minor = 0;
      newVersion.patch = 0;
      break;
    case 'minor':
      newVersion.minor += 1;
      newVersion.patch = 0;
      break;
    case 'patch':
      newVersion.patch += 1;
      break;
  }
  
  return newVersion;
};

// Compare version numbers
export const compareVersions = (v1: Version, v2: Version): number => {
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  return v1.patch - v2.patch;
};

// Generate patch between two schema versions
export const generatePatch = (
  previousSchema: any, 
  currentSchema: any, 
  version: Version,
  tier: VersionTier,
  description: string = '',
  isReleased: boolean = false
): SchemaPatch => {
  const patches = isReleased ? undefined : compare(previousSchema, currentSchema);
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    version: { ...version },
    description,
    patches,
    tier,
    isReleased,
    fullDocument: isReleased ? currentSchema : undefined,
    isSelected: true // New versions are selected by default
  };
};

// Save patches to database instead of localStorage
export const savePatches = async (patches: SchemaPatch[], documentId?: string): Promise<void> => {
  // This function is now handled by useDocumentVersions hook
  // Keeping for backward compatibility but it's a no-op
};

// Load patches from database instead of localStorage  
export const loadPatches = (documentId?: string): SchemaPatch[] => {
  // This function is now handled by useDocumentVersions hook
  // Keeping for backward compatibility but returns empty array
  return [];
};

// Calculate most recent version from patches
export const calculateLatestVersion = (patches: SchemaPatch[]): Version => {
  if (patches.length === 0) {
    return { major: 0, minor: 0, patch: 0 };
  }
  
  // Sort patches by timestamp, newest first
  const sortedPatches = [...patches].sort((a, b) => b.timestamp - a.timestamp);
  return sortedPatches[0].version;
};

// Check if a version already exists in the history
export const versionExists = (patches: SchemaPatch[], version: Version): boolean => {
  return patches.some(patch => 
    patch.version.major === version.major &&
    patch.version.minor === version.minor &&
    patch.version.patch === version.patch
  );
};

// Check if a version is higher than all existing versions
export const isVersionHigherThanAll = (patches: SchemaPatch[], version: Version): boolean => {
  if (patches.length === 0) return true;
  
  const latestVersion = calculateLatestVersion(patches);
  return compareVersions(version, latestVersion) > 0;
};

// Validate version for creation
export const validateVersionForCreation = (
  patches: SchemaPatch[], 
  version: Version
): { valid: boolean; error?: string; suggestedVersion?: Version } => {
  // Check if version already exists
  if (versionExists(patches, version)) {
    const latestVersion = calculateLatestVersion(patches);
    const suggestedVersion = bumpVersion(latestVersion, 'patch');
    return {
      valid: false,
      error: `Version ${formatVersion(version)} already exists in history`,
      suggestedVersion
    };
  }
  
  // Check if version is higher than all existing versions
  if (!isVersionHigherThanAll(patches, version)) {
    const latestVersion = calculateLatestVersion(patches);
    const suggestedVersion = bumpVersion(latestVersion, 'patch');
    return {
      valid: false,
      error: `Version ${formatVersion(version)} must be higher than the latest version ${formatVersion(latestVersion)}`,
      suggestedVersion
    };
  }
  
  return { valid: true };
};

// Reverse an operation's type
const reverseOperation = (op: Operation): Operation => {
  switch (op.op) {
    case 'add':
      return { 
        ...op, 
        op: 'remove' 
      } as Operation;
    case 'remove':
      return { 
        ...op, 
        op: 'add',
        // Type assertion to handle TypeScript error with value property
        value: (op as any).value  
      } as Operation;
    case 'replace':
      // For replace, we need the original value which would be in the value property
      // The actual reversal happens at application time since we need both values
      return { 
        ...op, 
        op: 'replace'
      } as Operation;
    default:
      return op; // Copy, move, and test operations remain the same
  }
};

// Safely create nested objects for a given path
const createNestedPath = (obj: any, path: string): void => {
  const parts = path.split('/').filter(part => part !== '');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
};

// Apply selected patches to build the current schema
export const applySelectedPatches = (patches: SchemaPatch[], upToTimestamp?: number): any => {
  
  // Validate that we have patches to work with
  if (!patches || patches.length === 0) {
    console.error('No patches provided to applySelectedPatches');
    console.log('Available patches:', patches);
    throw new Error('No version history available. The document may not have been properly saved.');
  }
  
  console.log('🔍 applySelectedPatches called with', {
    totalPatches: patches.length,
    selectedPatches: patches.filter(p => p.isSelected).length,
    upToTimestamp,
    patches: patches.map(p => ({
      id: p.id,
      version: formatVersion(p.version),
      isSelected: p.isSelected,
      isReleased: p.isReleased,
      description: p.description
    }))
  });
  
  // Sort patches by timestamp, oldest first
  const sortedPatches = [...patches].sort((a, b) => a.timestamp - b.timestamp);
  
  // Filter patches up to the target timestamp if specified
  const filteredPatches = upToTimestamp 
    ? sortedPatches.filter(patch => patch.timestamp <= upToTimestamp)
    : sortedPatches;
  
  // Find the latest selected released version as our base
  let baseSchema = {};
  let startIndex = 0;
  
  // Look through patches in reverse order to find the latest selected released version
  for (let i = filteredPatches.length - 1; i >= 0; i--) {
    const patch = filteredPatches[i];
    if (patch.isReleased && patch.isSelected) {
      if (patch.fullDocument) {
        baseSchema = JSON.parse(JSON.stringify(patch.fullDocument)); // Deep clone
        startIndex = i + 1;
        console.log('Found released version as base:', formatVersion(patch.version), 'with fullDocument');
        break;
      } else {
        // For initial version without fullDocument, apply all patches from beginning
        startIndex = 0;
        console.log('Found released version without fullDocument:', formatVersion(patch.version), 'applying from beginning');
        break;
      }
    }
  }
  
  // If no released version found, start with empty object
  
  // If we only have the base schema and no more patches to apply, return it
  if (startIndex >= filteredPatches.length) {
    console.log('Using base schema only, no additional patches to apply');
    // If we have a valid base schema from a released version, return it even if empty-looking
    // This handles cases where released versions contain valid schemas
    if (Object.keys(baseSchema).length === 0 && !filteredPatches.some(p => p.isReleased && p.isSelected)) {
      console.error('Base schema is empty and no released version found');
      throw new Error('Document content is empty. This may indicate a problem with the import process or version history.');
    }
    
    return baseSchema;
  }
  
  // Apply all selected patches after the base in chronological order
  let schema = baseSchema;
  
  for (let i = startIndex; i < filteredPatches.length; i++) {
    const patch = filteredPatches[i];
    if (patch.isSelected && patch.patches && patch.patches.length > 0) {
      try {
        // Pre-create paths for add operations to prevent "obj is undefined" errors
        for (const operation of patch.patches) {
          if (operation.op === 'add' && operation.path) {
            createNestedPath(schema, operation.path);
          }
        }
        
        schema = applyPatch(schema, patch.patches).newDocument;
      } catch (err) {
        console.error('Failed to apply patch:', patch, 'Error:', err);
        console.error('Current schema state:', JSON.stringify(schema, null, 2));
        
        // More informative error message
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error(`Failed to apply version ${formatVersion(patch.version)}: ${errorMessage}`);
        throw new Error(`Failed to apply version ${formatVersion(patch.version)}: ${errorMessage}`);
      }
    }
  }
  
  // Final validation - ensure the resulting schema is not empty
  if (!schema || (typeof schema === 'object' && Object.keys(schema).length === 0)) {
    console.error('Final schema is empty after applying patches');
    throw new Error('Resulting document is empty after applying version patches. This indicates a problem with the version history or patch application.');
  }
  
  return schema;
};

// Toggle selection of a patch
export const togglePatchSelection = (
  patches: SchemaPatch[], 
  patchId: string
): SchemaPatch[] => {
  const sortedPatches = [...patches].sort((a, b) => a.timestamp - b.timestamp);
  const targetIndex = sortedPatches.findIndex(p => p.id === patchId);
  
  if (targetIndex === -1) return patches;
  
  const targetPatch = sortedPatches[targetIndex];
  
  // Prevent deselecting the initial version
  if (targetPatch.description === 'Initial version' && targetPatch.isSelected) {
    toast.error('Cannot deselect initial version - it serves as the foundation document');
    return patches;
  }
  
  // Check if this is before a released version (cannot be deselected)
  // For a patch to be "before" a released version, there must be released versions with LATER timestamps
  const isBeforeReleased = sortedPatches.slice(targetIndex + 1).some(p => p.isReleased && p.description !== 'Initial version');
  if (isBeforeReleased && targetPatch.isSelected) {
    toast.error('Cannot deselect versions before a released version');
    return patches;
  }
  
  // Toggle the selection
  return patches.map(p => 
    p.id === patchId 
      ? { ...p, isSelected: !p.isSelected }
      : p
  );
};

// Mark a version as released
export const markAsReleased = (
  patches: SchemaPatch[], 
  patchId: string, 
  currentSchema: any
): SchemaPatch[] => {
  return patches.map(p => 
    p.id === patchId 
      ? { 
          ...p, 
          isReleased: true, 
          fullDocument: currentSchema,
          patches: undefined // Remove patches as we now store full document
        }
      : p
  );
};

// Delete a version from history
export const deleteVersion = (
  patches: SchemaPatch[], 
  patchId: string
): { success: boolean; updatedPatches: SchemaPatch[]; error?: string } => {
  const patchToDelete = patches.find(p => p.id === patchId);
  
  if (!patchToDelete) {
    return { success: false, updatedPatches: patches, error: 'Version not found' };
  }
  
  // Don't allow deletion of initial version
  if (patchToDelete.description === 'Initial version') {
    return { success: false, updatedPatches: patches, error: 'Cannot delete initial version' };
  }
  
  // Check if this is a released version that other versions depend on
  const sortedPatches = [...patches].sort((a, b) => a.timestamp - b.timestamp);
  const patchIndex = sortedPatches.findIndex(p => p.id === patchId);
  const hasLaterVersions = sortedPatches.slice(patchIndex + 1).length > 0;
  
  if (patchToDelete.isReleased && hasLaterVersions) {
    return { 
      success: false, 
      updatedPatches: patches, 
      error: 'Cannot delete released version with dependent versions' 
    };
  }
  
  // Remove the patch
  const updatedPatches = patches.filter(p => p.id !== patchId);
  
  return { success: true, updatedPatches };
}

// Extract version from document content based on file type
export const extractVersionFromDocument = (content: any, fileType: string): Version => {
  let versionString: string | undefined;
  
  if (fileType === 'json-schema') {
    versionString = content?.version;
  } else {
    // openapi, diagram, markdown all use info.version
    versionString = content?.info?.version;
  }
  
  if (versionString && typeof versionString === 'string') {
    return parseVersion(versionString);
  }
  
  return { major: 0, minor: 0, patch: 1 }; // Default to 0.0.1
};

// Update version in document content based on file type
export const updateDocumentVersion = (content: any, fileType: string, version: Version): any => {
  const versionString = formatVersion(version);
  const updated = JSON.parse(JSON.stringify(content)); // Deep clone
  
  if (fileType === 'json-schema') {
    updated.version = versionString;
  } else {
    // openapi, diagram, markdown all use info.version
    if (!updated.info) {
      updated.info = {};
    }
    updated.info.version = versionString;
  }
  
  return updated;
};
