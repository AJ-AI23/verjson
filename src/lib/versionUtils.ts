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
  patches: Operation[];
  tier: VersionTier;
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
  description: string = ''
): SchemaPatch => {
  const patches = compare(previousSchema, currentSchema);
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    version: { ...version },
    description,
    patches,
    tier
  };
};

// Save patches to localStorage (temporary solution)
export const savePatches = (patches: SchemaPatch[]): void => {
  try {
    localStorage.setItem('schema-patches', JSON.stringify(patches));
    console.log('Patches saved to localStorage');
  } catch (err) {
    console.error('Failed to save patches to localStorage:', err);
    toast.error('Failed to save version history');
  }
};

// Load patches from localStorage
export const loadPatches = (): SchemaPatch[] => {
  try {
    const storedPatches = localStorage.getItem('schema-patches');
    if (storedPatches) {
      return JSON.parse(storedPatches);
    }
  } catch (err) {
    console.error('Failed to load patches from localStorage:', err);
    toast.error('Failed to load version history');
  }
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
        value: op.value  // Make sure value is included
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

// Apply patches in reverse from current version back to target version
export const revertToVersion = (
  currentSchema: any, 
  patches: SchemaPatch[], 
  targetPatch: SchemaPatch
): any => {
  // Sort patches by timestamp, newest first
  const sortedPatches = [...patches].sort((a, b) => b.timestamp - a.timestamp);
  
  // Find all patches that are newer than the target patch
  const patchesToRevert = sortedPatches.filter(
    patch => patch.timestamp > targetPatch.timestamp
  );
  
  if (patchesToRevert.length === 0) {
    toast.info('Already at the requested version');
    return currentSchema;
  }
  
  let schema = { ...currentSchema };
  
  // Apply each patch in reverse
  for (const patch of patchesToRevert) {
    try {
      // Reverse each operation in the patch
      const reversedOperations = [...patch.patches]
        .reverse() // Process operations in reverse order
        .map(reverseOperation);
      
      // Apply reversed operations
      schema = applyPatch(schema, reversedOperations).newDocument;
      
    } catch (err) {
      console.error('Failed to revert patch:', err);
      toast.error(`Failed to revert to version ${formatVersion(targetPatch.version)}`);
      throw err;
    }
  }
  
  return schema;
};
