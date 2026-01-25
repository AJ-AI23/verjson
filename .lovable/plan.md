
Goal: stop “logout/session-expired → redirected to /auth → automatically redirected back to / as if logged-in” loops by (1) making frontend auth state reflect backend reality, (2) having a single, consistent policy for 401 vs 403, and (3) preventing the Auth page from auto-redirecting while a logout/invalid-session recovery is in progress.

---

What’s happening now (root cause analysis)

1) Frontend can believe a session exists even when backend rejects it
- `AuthProvider` sets `user/session` from `supabase.auth.getSession()` and `onAuthStateChange(...)` without validating the session with the server.
- If the stored session is stale/invalid (JWT expired, user deleted, etc.), the app still has `user != null` in React state.

2) `/auth` page will redirect to `/` whenever `user` is truthy
- `src/pages/Auth.tsx` has an effect that redirects to `/` if `user` exists.
- It tries to guard this with `logout-in-progress`, but currently that guard only blocks one run:
  - It removes the flag and returns early.
  - Then when `loading` or `user` changes, the effect runs again (flag no longer exists), sees `user`, and redirects to `/`.

3) “demo session check” errors don’t prevent redirect
- In `Auth.tsx`, the demo session query errors are logged, but redirect continues anyway.
- If the token is invalid, this query likely fails; the page still redirects to `/`, feeding the loop.

4) 401/403 handling is inconsistent across the app
- Many hooks/components call `supabase.functions.invoke(...)` directly and do not consistently apply session-invalid handling.
- `useEdgeFunctionWithAuth` currently treats `{ error: 'Unauthorized' }` in the body as “session expired” which may be too broad; and most callers aren’t using it anyway.
- Some hooks use `checkDemoSessionExpired(...)`, but only check `isDemoExpired`, while `checkDemoSessionExpired` also triggers redirects for JWT-invalid patterns—this creates split-brain behavior.

Resulting loop (common timeline)
- Backend returns 401 for invalid JWT → redirect logic triggers → user sent to `/auth`
- `/auth` sees `user` still set (because session wasn’t truly cleared/validated) → redirects back to `/`
- `/` triggers requests again → 401 again → repeat

---

Target behavior (rules)

A) Explicit user logout
- Must always end with: `user=null, session=null`, auth token removed locally, and user stays on `/auth` until they sign in again.
- No automatic bounce back to `/` based on stale state.

B) Backend returns 401 (Unauthorized)
- Treat as “auth invalid”: clear local session and redirect to `/auth?expired=true` (or similar).
- Never attempt to keep user “logged in” locally after a 401 from protected endpoints.

C) Backend returns 403 (Forbidden)
- Treat as “authenticated but not allowed”: do NOT sign out.
- Show an error/toast and/or clear the selected resource (document/workspace) but keep the session.

---

Implementation approach (high-level)

1) Make AuthProvider validate sessions against the backend
- Add a lightweight “session validation” step any time we initialize or receive a session:
  - After `getSession()` finds a session, call `supabase.auth.getUser()` (or equivalent) to confirm the token is actually accepted server-side.
  - If it fails with session-invalid signals (JWT expired, sub not found, etc.), immediately clear local auth state and storage.
- Ensure this validation is done outside the `onAuthStateChange` callback (using `setTimeout(0)` or a separate effect) to avoid deadlocks.

2) Fix `/auth` redirect logic to be robust (no more “one-run” guard)
- Change `logout-in-progress` semantics:
  - Do not remove it immediately on mount.
  - While it is set, do not auto-redirect to `/` even if `user` is temporarily truthy.
  - Only clear it once we have confirmed `user` and `session` are null OR after a short TTL (e.g., 2–5 seconds) AND session validation passed.
- Additionally, stop redirecting on `/auth` based on `user` alone; redirect only when:
  - `session` exists AND session validation succeeded.
- If session validation fails, remain on `/auth` and show the “expired” message.

3) Centralize edge-function auth error handling (401 vs 403) and apply it consistently
- Evolve `useEdgeFunctionWithAuth` into the single standard wrapper for protected edge-function calls:
  - If Supabase returns `FunctionsHttpError` with `context.status === 401`: trigger `handleSessionExpired()` (clear local + redirect).
  - If `context.status === 403`: return error to caller (no logout).
  - Avoid relying on string matching or `"Unauthorized"` body checks as the primary signal; prefer HTTP status.
- Update key hooks that run frequently / during initial app boot to use the wrapper:
  - permissions hooks: `useDocumentPermissions`, `useWorkspacePermissions`, `useInvitations`, `useUserPermissions`
  - core data: `useDocuments`, `useWorkspaces`, `useSharedDocuments`, `useDocumentContent`, notifications hooks
- This is critical so that a 401 always triggers the same cleanup/redirect behavior no matter where it occurs.

4) Make “force local logout” truly local and deterministic
- In logout/expired handlers, do:
  - `supabase.auth.signOut({ scope: 'local' })` (so local storage clears even if network fails)
  - remove the known localStorage key `sb-swghcmyqracwifpdfyap-auth-token` as a safety net
  - set `logout-in-progress` with a timestamp to prevent redirect races
  - use `window.location.replace(...)` to prevent back-button loops

5) Harden the Auth page’s “demo session expiration” branch
- If the demo session check fails due to auth problems, treat it as “cannot validate session” and do NOT redirect to `/`.
- If demo session is expired:
  - use the same local-signout routine (clear token + state) and remain on `/auth` (optionally show demo-expired dialog/message).

6) Add minimal observability to confirm correctness
- Add consistent, low-noise logs (or debug-only logs) around:
  - “session validated OK / failed”
  - “redirect suppressed due to logout-in-progress”
  - “401 => logout” vs “403 => show forbidden”
- Optional (but recommended): add a Playwright test that:
  - logs in, logs out, confirms it stays on `/auth`
  - simulates invalid session token and confirms it lands on `/auth?expired=true` without bouncing back to `/`

---

Concrete file touch list (where changes will be made)

Frontend:
- `src/contexts/AuthContext.tsx`
  - add session validation after getSession/onAuthStateChange
  - implement a single “forceLocalSignOut” used by signOut + handleSessionExpired
- `src/pages/Auth.tsx`
  - change redirect logic to require validated session, and fix logout-in-progress lifecycle (don’t clear immediately)
  - don’t redirect to `/` if demo-session check errors or session invalid
- `src/pages/Index.tsx`
  - minor: use `replace` redirects; optionally add guard to avoid redirecting to `/auth` if already there
- `src/hooks/useEdgeFunctionWithAuth.ts`
  - make status-based 401/403 handling authoritative; avoid body-string heuristic as primary
- Hooks that call edge functions directly (at minimum the “boot path” ones):
  - `src/hooks/useWorkspaces.ts`, `src/hooks/useDocuments.ts`
  - `src/hooks/useDocumentContent.ts`
  - `src/hooks/useWorkspacePermissions.ts`, `src/hooks/useDocumentPermissions.ts`
  - `src/hooks/useInvitations.ts`, `src/hooks/useUserPermissions.ts`
  - (then expand to others like notifications, crowdin, versions as follow-up)

Backend (optional follow-up if needed):
- Consider ensuring edge functions return 403 for permission problems and 401 only for auth problems (some already do, but we’ll verify the ones involved in the loop).

---

Acceptance criteria (how we’ll know it’s fixed)

- Clicking “Log out” always lands you on `/auth` and you remain there until you explicitly sign in.
- If any protected edge function returns 401, the user is sent to `/auth?expired=true` and does not bounce back to `/`.
- 403 errors do not log the user out; they see an access/permission error and remain authenticated.
- No infinite redirects between `/` and `/auth` under invalid/expired token conditions.
