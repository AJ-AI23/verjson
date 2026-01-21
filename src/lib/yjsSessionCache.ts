import * as Y from 'yjs';

export interface YjsSession {
  documentId: string;
  doc: Y.Doc;
  text: Y.Text;
  lastAccess: number;
  /** True once the user has made local edits in this browser session */
  dirty: boolean;
}


const MAX_SESSIONS = 10;
const sessions = new Map<string, YjsSession>();

function evictIfNeeded() {
  if (sessions.size <= MAX_SESSIONS) return;

  // LRU eviction
  const sorted = Array.from(sessions.values()).sort((a, b) => a.lastAccess - b.lastAccess);
  const toEvict = sorted.slice(0, sessions.size - MAX_SESSIONS);

  for (const session of toEvict) {
    try {
      session.doc.destroy();
    } catch {
      // ignore
    }
    sessions.delete(session.documentId);
  }
}

export function getOrCreateYjsSession(documentId: string, initialContent?: string): YjsSession {
  const existing = sessions.get(documentId);
  if (existing) {
    existing.lastAccess = Date.now();

    // If the session is marked dirty but we receive authoritative initialContent, we may still
    // want to hydrate in a few safe cases (e.g. the cached content is an empty/template doc).
    // This prevents the editor from getting stuck showing a template forever.
    if (existing.dirty && initialContent) {
      try {
        const currentText = existing.text.toString();
        if (currentText.trim().length === 0) {
          existing.dirty = false;
        } else {
          const currentParsed = JSON.parse(currentText);
          const incomingParsed = JSON.parse(initialContent);

          const isDiagram = (v: any) =>
            v &&
            typeof v === 'object' &&
            (v.verjson !== undefined || v.nodes !== undefined || v.lifelines !== undefined || v.data?.nodes !== undefined);

          const getDiagramCounts = (v: any) => {
            const data = v?.data ?? v;
            const nodes = Array.isArray(data?.nodes) ? data.nodes.length : 0;
            const lifelines = Array.isArray(data?.lifelines) ? data.lifelines.length : 0;
            const processes = Array.isArray(data?.processes) ? data.processes.length : 0;
            const edges = Array.isArray(data?.edges) ? data.edges.length : 0;
            return { nodes, lifelines, processes, edges };
          };

          const isOpenApi = (v: any) => v && typeof v === 'object' && (v.openapi || v.swagger);
          const getOpenApiCounts = (v: any) => {
            const paths = v?.paths && typeof v.paths === 'object' ? Object.keys(v.paths).length : 0;
            const components = v?.components && typeof v.components === 'object' ? Object.keys(v.components).length : 0;
            return { paths, components };
          };

          // If cached looks like a placeholder and incoming is richer, allow hydration.
          if (isDiagram(currentParsed) && isDiagram(incomingParsed)) {
            const cur = getDiagramCounts(currentParsed);
            const inc = getDiagramCounts(incomingParsed);
            const currentEmpty = cur.nodes + cur.lifelines + cur.processes + cur.edges === 0;
            const incomingHasData = inc.nodes + inc.lifelines + inc.processes + inc.edges > 0;
            if (currentEmpty && incomingHasData) {
              existing.dirty = false;
            }
          } else if (isOpenApi(currentParsed) && isOpenApi(incomingParsed)) {
            const cur = getOpenApiCounts(currentParsed);
            const inc = getOpenApiCounts(incomingParsed);
            if (cur.paths === 0 && inc.paths > 0) {
              existing.dirty = false;
            }
          }
        }
      } catch {
        // If parsing fails, keep the conservative behavior (do not hydrate over dirty).
      }
    }

    // Once the user has made local edits, the cache becomes authoritative.
    // Don't parse / hydrate on every upstream value change.
    if (existing.dirty) return existing;

    // If we receive authoritative initialContent later (e.g. after async load),
    // hydrate the cached doc only if the user hasn't made local edits yet.
    if (initialContent) {
      try {
        JSON.parse(initialContent);

        const current = existing.text.toString();
        const shouldHydrate =
          current.length === 0 || (!existing.dirty && current !== initialContent);

        if (shouldHydrate) {
          existing.doc.transact(() => {
            existing.text.delete(0, existing.text.length);
            existing.text.insert(0, initialContent);
          }, 'init');
        }
      } catch {
        // skip if not valid JSON
      }
    }

    return existing;
  }

  const doc = new Y.Doc();
  const text = doc.getText('content');

  if (initialContent && text.length === 0) {
    try {
      JSON.parse(initialContent);
      doc.transact(() => {
        text.insert(0, initialContent);
      }, 'init');
    } catch {
      // If initial content isn't valid JSON, skip insertion.
      // The editor will still function and can write valid JSON later.
    }
  }

  const session: YjsSession = {
    documentId,
    doc,
    text,
    lastAccess: Date.now(),
    dirty: false
  };


  sessions.set(documentId, session);
  evictIfNeeded();

  return session;
}



/**
 * Reset the dirty flag for a session, allowing it to be hydrated with new content.
 * Call this when the user explicitly switches to a document to ensure fresh content loads.
 */
export function resetYjsSessionDirtyFlag(documentId: string): void {
  const session = sessions.get(documentId);
  if (session) {
    session.dirty = false;
  }
}

export function clearYjsSession(documentId: string) {
  const session = sessions.get(documentId);
  if (!session) return;

  try {
    session.doc.destroy();
  } catch {
    // ignore
  }

  sessions.delete(documentId);
}
