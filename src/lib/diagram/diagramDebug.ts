export type DiagramDebugEvent = {
  t: number;
  scope: string;
  message: string;
  data?: unknown;
};

declare global {
  interface Window {
    __diagramDebugEvents?: DiagramDebugEvent[];
  }
}

export const isDiagramDebugEnabled = () => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('diagram-debug-mode') === 'true';
  } catch {
    return false;
  }
};

const pushEvent = (event: DiagramDebugEvent) => {
  if (typeof window === 'undefined') return;
  const buf = (window.__diagramDebugEvents ||= []);
  buf.push(event);
  if (buf.length > 300) buf.splice(0, buf.length - 300);
};

/**
 * Diagram debug logger.
 * - Uses console.log (more reliably captured than console.info in some environments)
 * - Stores a rolling buffer in window.__diagramDebugEvents
 */
export const diagramDbg = (scope: string, message: string, data?: unknown) => {
  if (!isDiagramDebugEnabled()) return;

  const evt: DiagramDebugEvent = {
    t: Date.now(),
    scope,
    message,
    data,
  };

  pushEvent(evt);
  // eslint-disable-next-line no-console
  console.log(`[DiagramDebug][${scope}] ${message}`, data ?? '');
};
