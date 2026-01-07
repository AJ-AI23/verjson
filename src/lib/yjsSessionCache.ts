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
