# VerJSON Configuration System

The merge engine now uses JSON configuration files as the source of truth for all conflict detection, resolutions, preferences, and merge modes.

## Configuration Files

### Conflict Registry (`src/lib/config/verjson-conflict-registry.v1.json`)
Defines all conflict types with:
- Valid resolutions
- Severity levels
- Manual review requirements
- Applicable preferences
- Description templates

### Merge Modes (`src/lib/config/verjson-merge-modes.v1.json`)
Defines 4 merge modes:
- **additive**: Favor inclusion and expansion (union operations)
- **subtractive**: Favor reduction and strictness (intersection operations)
- **interpolate**: Favor reconstruction between versions
- **extrapolate**: Favor forward projection from incoming

### Rename Detection Strategy

The `renameDetectionStrategy` preference controls how aggressively the merge engine detects renamed definitions and properties:

- **strict**: Requires both structure match AND name similarity (Levenshtein distance ≤ 3). Conservative, minimizes false positives.
  - Example: `User` → `UserData` ✓, `User` → `Person` ✗

- **moderate** (default): Prioritizes structure match with name similarity as tiebreaker (Levenshtein distance ≤ 8). Balanced approach.
  - Example: `User` → `UserData` ✓, `User` → `Person` ✓, `User` → `Customer` ✓

- **loose**: Structure match only, no name similarity requirement. Most aggressive, may produce false positives.
  - Example: Any structurally identical definitions are considered renames, regardless of name

**Recommended settings:**
- Use `strict` for stable APIs where renames should be explicit
- Use `moderate` for active development with refactoring
- Use `loose` for automated migrations where structure is the source of truth

## Usage

### Loading Conflict Information
```typescript
import { conflictRegistry } from '@/lib/config';

// Get valid resolutions for a conflict type
const resolutions = conflictRegistry.getValidResolutions('property_removed_required');

// Get severity
const severity = conflictRegistry.getSeverity('property_removed_required');

// Check if manual review required
const needsReview = conflictRegistry.requiresManualReview('property_removed_required');

// Get applicable preferences
const prefs = conflictRegistry.getApplicablePreferences('array_items_added');
```

### Using Merge Modes
```typescript
import { mergeModeLoader } from '@/lib/config';

// Get mode configuration
const mode = mergeModeLoader.getMode('additive');

// Get preferred resolution order
const order = mergeModeLoader.getPreferredResolutionOrder('additive');

// Get default preferences for mode
const defaults = mergeModeLoader.getDefaultPreferences('additive');

// Get suggested resolution
const suggested = mergeModeLoader.getSuggestedResolution('additive', validResolutions);
```

### Preference Management
```typescript
import { getPreferenceDefinition, getPreferenceValues, getDefaultPreferences } from '@/lib/conflictPreferenceRules';

// Get all default preferences
const defaults = getDefaultPreferences();

// Get preference definition
const def = getPreferenceDefinition('arrayMergeStrategy');

// Get possible values for enum preference
const values = getPreferenceValues('arrayMergeStrategy'); // ['union', 'intersection', ...]
```

## Extending the System

To add new conflict types or preferences:
1. Update `verjson-conflict-registry.v1.json`
2. Add the conflict type to the `ConflictType` union in `documentMergeEngine.ts`
3. TypeScript types will automatically reflect the changes
