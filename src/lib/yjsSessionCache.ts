import * as Y from 'yjs';

export interface YjsSession {
  documentId: string;
  doc: Y.Doc;
  text: Y.Text;
  lastAccess: number;
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

    // If the cached doc is empty but we now have initialContent, populate it.
    // This can happen when a session was created before the server data arrived.
    if (initialContent && existing.text.length === 0) {
      try {
        JSON.parse(initialContent);
        existing.doc.transact(() => {
          existing.text.insert(0, initialContent);
        }, 'init');
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
    lastAccess: Date.now()
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
