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
  console.log('savePatches called - now handled by database operations');
};

// Load patches from database instead of localStorage  
export const loadPatches = (documentId?: string): SchemaPatch[] => {
  // This function is now handled by useDocumentVersions hook
  // Keeping for backward compatibility but returns empty array
  console.log('loadPatches called - now handled by database operations');
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

// Apply selected patches to build the current schema
export const applySelectedPatches = (patches: SchemaPatch[]): any => {
  console.log('🔍 applySelectedPatches called with:', {
    totalPatches: patches.length,
    patchDetails: patches.map(p => ({ 
      id: p.id, 
      description: p.description, 
      isSelected: p.isSelected,
      isReleased: p.isReleased,
      hasFullDocument: !!p.fullDocument,
      hasPatches: !!p.patches,
      timestamp: p.timestamp,
      version: formatVersion(p.version)
    }))
  });
  
  // Validate that we have patches to work with
  if (!patches || patches.length === 0) {
    console.error('No patches provided to applySelectedPatches');
    throw new Error('No version history available. The document may not have been properly saved.');
  }
  
  // Sort patches by timestamp, oldest first
  const sortedPatches = [...patches].sort((a, b) => a.timestamp - b.timestamp);
  
  // Find the latest selected released version as our base
  let baseSchema = {};
  let startIndex = 0;
  
  // Look through patches in reverse order to find the latest selected released version
  for (let i = sortedPatches.length - 1; i >= 0; i--) {
    const patch = sortedPatches[i];
    if (patch.isReleased && patch.isSelected) {
      if (patch.fullDocument) {
        baseSchema = JSON.parse(JSON.stringify(patch.fullDocument)); // Deep clone
        startIndex = i + 1;
        console.log(`Using released version ${formatVersion(patch.version)} as base with fullDocument:`, {
          keys: Object.keys(patch.fullDocument),
          hasContent: Object.keys(patch.fullDocument).length > 0,
          preview: JSON.stringify(patch.fullDocument).substring(0, 200)
        });
        break;
      } else {
        // For initial version without fullDocument, apply all patches from beginning
        console.log(`Using released version ${formatVersion(patch.version)} as base, applying all patches`);
        startIndex = 0;
        break;
      }
    }
  }
  
  // If no released version found, start with empty object
  if (startIndex === 0 && Object.keys(baseSchema).length === 0) {
    console.log('No released version found, starting with empty schema');
  }
  
  // If we only have the base schema and no more patches to apply, return it
  if (startIndex >= sortedPatches.length) {
    console.log('No additional patches to apply, returning base schema with keys:', Object.keys(baseSchema));
    
    // Validate that the base schema is not empty
    if (Object.keys(baseSchema).length === 0) {
      console.error('Base schema is empty, this indicates a problem with document loading');
      throw new Error('Document content is empty. This may indicate a problem with the import process or version history.');
    }
    
    return baseSchema;
  }
  
  // Apply all selected patches after the base in chronological order
  let schema = baseSchema;
  
  for (let i = startIndex; i < sortedPatches.length; i++) {
    const patch = sortedPatches[i];
    if (patch.isSelected && patch.patches && patch.patches.length > 0) {
      try {
        console.log(`Applying patch ${formatVersion(patch.version)}:`, patch.description);
        schema = applyPatch(schema, patch.patches).newDocument;
      } catch (err) {
        console.error('Failed to apply patch:', patch, err);
        toast.error(`Failed to apply version ${formatVersion(patch.version)}`);
        throw err;
      }
    }
  }
  
  console.log('Final schema has keys:', Object.keys(schema));
  
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
  const isBeforeReleased = sortedPatches.slice(targetIndex + 1).some(p => p.isReleased);
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
};
