// @refresh reset
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { useAuth } from '@/contexts/AuthContext';
import { CustomYjsProvider } from './useCustomYjsProvider';
import { getOrCreateYjsSession, type YjsSession } from '@/lib/yjsSessionCache';


interface UseYjsDocumentProps {
  documentId: string | null;
  collaborationEnabled?: boolean;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

interface UseYjsDocumentResult {
  yjsDoc: Y.Doc | null;
  provider: CustomYjsProvider | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  activeUsers: Array<{
    id: string;
    name?: string;
    avatar?: string;
    cursor?: any;
  }>;
  getTextContent: () => string;
  updateContent: (content: string) => void;
  disconnect: () => void;
}

export const useYjsDocument = ({
  documentId,
  collaborationEnabled = false,
  initialContent,
  onContentChange
}: UseYjsDocumentProps): UseYjsDocumentResult => {
  const { user, session, profile } = useAuth();
  const [yjsDoc, setYjsDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<CustomYjsProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<Array<{
    id: string;
    name?: string;
    avatar?: string;
    cursor?: any;
  }>>([]);

  const textRef = useRef<Y.Text | null>(null);
  const observerRef = useRef<((event: Y.YTextEvent) => void) | null>(null);

  const sessionRef = useRef<YjsSession | null>(null);

  const providerRef = useRef<CustomYjsProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const awarenessChangeHandlerRef = useRef<(() => void) | null>(null);

  const onContentChangeRef = useRef<typeof onContentChange>(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  // Track the documentId that has been fully initialized so we can gate hydration.
  const stableDocIdRef = useRef<string | null>(null);

  // Prevent repeatedly hydrating the same document from `initialContent`.
  // This is critical because hydration in yjsSessionCache uses a non-null origin
  // (e.g. 'init') which UndoManager does not track by default; if we hydrate on
  // every React state update (like typing in the markdown textarea), changes will
  // bypass the shared Yjs undo/redo history.
  const didHydrateFromInitialContentRef = useRef<Set<string>>(new Set());


  const getAuthToken = useCallback(() => {
    return session?.access_token || null;
  }, [session]);


  const disconnectProvider = useCallback(() => {
    // Awareness cleanup (only relevant when collaboration is enabled)
    if (awarenessRef.current && awarenessChangeHandlerRef.current) {
      awarenessRef.current.off('change', awarenessChangeHandlerRef.current);
    }

    awarenessRef.current = null;
    awarenessChangeHandlerRef.current = null;

    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    setProvider(null);
    setIsConnected(false);
    setIsLoading(false);
    setActiveUsers([]);
  }, []);

  const disconnect = useCallback(() => {
    if (observerRef.current && textRef.current) {
      textRef.current.unobserve(observerRef.current);
    }

    observerRef.current = null;
    textRef.current = null;
    sessionRef.current = null;

    disconnectProvider();

    // IMPORTANT: we intentionally do NOT destroy the Y.Doc.
    // We keep it in an in-memory cache so local undo/redo history persists
    // when switching documents and coming back during the same browser session.
    setYjsDoc(null);
  }, [disconnectProvider]);


  const getTextContent = useCallback(() => {
    return textRef.current?.toString() || '';
  }, []);

  const updateContent = useCallback((content: string) => {
    const text = textRef.current;
    if (!text) return;

    const current = text.toString();
    if (current === content) return;

    // Mark session as having local edits so we don't auto-hydrate over it later.
    if (sessionRef.current) {
      sessionRef.current.dirty = true;
      sessionRef.current.lastAccess = Date.now();
    }

    // Group into a single transaction so UndoManager treats it as one step.
    // IMPORTANT: don't pass a custom origin here; UndoManager typically tracks `null` origin.
    text.doc?.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Reset stableDocIdRef immediately when documentId changes so hydration effect waits.
    stableDocIdRef.current = null;

    // Tear down provider + observers for the previous document / mode.
    disconnect();

    if (!documentId) {
      return () => {
        // disconnect already called above
      };
    }


    // Always create (or reuse) a local Y.Doc so undo/redo works even without collaboration.
    // NOTE: we do NOT hydrate from initialContent here to avoid re-initializing on every keystroke.
    const sessionDoc = getOrCreateYjsSession(documentId);
    const text = sessionDoc.text;

    sessionRef.current = sessionDoc;
    textRef.current = text;
    setYjsDoc(sessionDoc.doc);

    // Observe changes (valid JSON only) and propagate to the parent.
    const observer = () => {
      const content = text.toString();
      try {
        JSON.parse(content);
        onContentChangeRef.current?.(content);
      } catch {
        // ignore invalid intermediate states
      }
    };

    observerRef.current = observer;
    text.observe(observer);

    // Mark this documentId as stable so hydration effect can run.
    stableDocIdRef.current = documentId;

    // If there are local unsaved edits for this doc, surface them immediately.
    // Otherwise, let the outer React state (server-loaded) remain authoritative.
    if (sessionDoc.dirty) {
      try {
        const current = text.toString();
        if (current) {
          JSON.parse(current);
          onContentChangeRef.current?.(current);
        }
      } catch {
        // ignore
      }
    }


    const connectCollaboration = async () => {
      if (!collaborationEnabled) {
        setError(null);
        setIsLoading(false);
        return;
      }

      if (!user) {
        setError('You must be signed in to use collaboration');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const authToken = await getAuthToken();
        if (cancelled) return;

        const awareness = new Awareness(sessionDoc.doc);
        awarenessRef.current = awareness;

        awareness.setLocalStateField('user', {
          id: user.id,
          name: profile?.full_name || profile?.username || user.email?.split('@')[0] || 'Anonymous',
          avatar: profile?.avatar_url
        });

        const handleAwarenessChange = () => {
          const users = Array.from(awareness.getStates().entries())
            .filter(([clientId]) => clientId !== awareness.clientID)
            .map(([clientId, state]) => ({
              id: state.user?.id || clientId.toString(),
              name: state.user?.name,
              avatar: state.user?.avatar,
              cursor: state.cursor
            }));
          setActiveUsers(users);
        };

        awarenessChangeHandlerRef.current = handleAwarenessChange;
        awareness.on('change', handleAwarenessChange);

        const wsUrl = `wss://swghcmyqracwifpdfyap.functions.supabase.co/functions/v1/yjs-sync?documentId=${documentId}&token=${authToken}`;
        const wsProvider = new CustomYjsProvider(wsUrl, documentId, sessionDoc.doc, awareness);

        providerRef.current = wsProvider;
        setProvider(wsProvider);

        wsProvider.on('status', (event: { status: string }) => {
          setIsConnected(event.status === 'connected');
          if (event.status === 'connected') {
            setIsLoading(false);
          }
        });

        wsProvider.on('connection-error', (event: Event) => {
          console.error('WebSocket connection error:', event);
          setError('Failed to connect to collaboration server');
          setIsLoading(false);
        });

        wsProvider.on('synced', () => {
          setIsLoading(false);
        });

      } catch (err) {
        console.error('Error initializing Yjs collaboration:', err);
        setError('Failed to initialize collaborative editing');
        setIsLoading(false);
      }
    };

    connectCollaboration();

    return () => {
      cancelled = true;

      if (observerRef.current && textRef.current) {
        textRef.current.unobserve(observerRef.current);
      }

      observerRef.current = null;
      textRef.current = null;
      sessionRef.current = null;

      disconnectProvider();


      // Do NOT destroy sessionDoc.doc (kept in cache)
      setYjsDoc(null);
    };
  }, [documentId, collaborationEnabled, user, profile, getAuthToken, disconnect, disconnectProvider]);

  // Hydrate cached docs from authoritative initialContent (e.g. server-loaded JSON)
  // without tearing down observers/providers.
  // IMPORTANT: only run when stableDocIdRef matches to avoid hydrating old content into new doc.
  useEffect(() => {
    if (!documentId || !initialContent) return;
    // Wait until the main effect has finished setting up and marked documentId as stable.
    if (stableDocIdRef.current !== documentId) return;

    // Only hydrate once per document id.
    // After the initial hydration, subsequent content changes should flow through
    // `updateContent()` (null origin) so UndoManager can track shared history.
    if (didHydrateFromInitialContentRef.current.has(documentId)) return;

    // If the user has started editing locally (e.g. via preview textarea), don't overwrite.
    if (sessionRef.current?.dirty) return;

    getOrCreateYjsSession(documentId, initialContent);
    didHydrateFromInitialContentRef.current.add(documentId);
  }, [documentId, initialContent]);


  return {
    yjsDoc,
    provider,
    isConnected,
    isLoading,
    error,
    activeUsers,
    getTextContent,
    updateContent,
    disconnect
  };
};
