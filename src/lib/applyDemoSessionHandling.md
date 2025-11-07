# Demo Session Error Handling - Applied Hooks

This document tracks which hooks have been updated to handle demo session expiration errors.

## Pattern to Apply

```typescript
// Add to imports
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { checkDemoSessionExpired } from '@/lib/supabaseErrorHandler';

// In hook body
const { handleDemoExpiration } = useDemoSession();

// In error handling
if (error) {
  const { isDemoExpired } = checkDemoSessionExpired(error);
  if (isDemoExpired) {
    handleDemoExpiration();
    return; // or return null, depending on function signature
  }
  throw error;
}
```

## Completed Hooks

- ✅ `useDocuments.ts` - All functions updated (4/4)
  - fetchDocuments
  - createDocument
  - updateDocument
  - deleteDocument

- ✅ `useWorkspaces.ts` - All functions updated (4/4)
  - queryFn (listUserWorkspaces)
  - createWorkspace
  - updateWorkspace
  - deleteWorkspace

- ✅ `useWorkspacePermissions.ts` - All functions updated (5/5)
  - fetchPermissions
  - inviteToWorkspace
  - inviteBulkDocuments
  - updatePermission
  - removePermission

## Remaining Hooks to Update

The following hooks still need demo session error handling:
- ⏳ `useNotifications.ts` (4 functions)
- ⏳ `useInvitations.ts` (3 functions)
- ⏳ `useDocumentVersions.ts` (7 functions)
- ⏳ `useDocumentPermissions.ts` (4 functions)
- ⏳ `useDocumentPinSecurity.ts` (4 functions)
- ⏳ `useDocumentContent.ts` (1 function)
- ⏳ `useSharedDocuments.ts` (1 function)
- ⏳ `useUserPermissions.ts` (2 functions)
- ⏳ `useUserProfile.ts` (2 functions)

## Implementation Details

### Error Detection
The `checkDemoSessionExpired()` function checks for:
- HTTP 401 status codes
- Error messages/bodies containing "Demo session expired"
- Various error object formats (FunctionsHttpError, plain objects, etc.)

### Flow
1. Backend returns 401 with `{"error":"Demo session expired"}`
2. Frontend detects error via `checkDemoSessionExpired()`
3. Triggers `handleDemoExpiration()` which:
   - Shows expiration dialog
   - Waits 5 seconds
   - Redirects to `/auth`

### UI Components
- `DemoSessionRibbon` - Countdown timer at top of page
- `DemoSessionContext` - Manages expiration dialog and redirect
- Dialog shows for 5 seconds before automatic redirect

## Notes

- The ribbon changes to red with warning icon when <2 minutes remain
- All `supabase.functions.invoke()` calls should be wrapped with this error handling
- The error handler logs which detection method found the expired session

