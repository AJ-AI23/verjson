export interface DiagramStyleTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    swimlaneBackground: string;
    swimlaneBorder: string;
    nodeBackground: string;
    nodeBorder: string;
    nodeText: string;
    edgeStroke: string;
    edgeLabel: string;
    nodeTypes: {
      endpoint: { background: string; border: string; text: string };
      process: { background: string; border: string; text: string };
      decision: { background: string; border: string; text: string };
      data: { background: string; border: string; text: string };
      custom: { background: string; border: string; text: string };
    };
  };
  fonts: {
    nodeFont: string;
    nodeFontSize: string;
    edgeFontSize: string;
  };
}

export interface DiagramStyles {
  themes: {
    light: DiagramStyleTheme;
    dark?: DiagramStyleTheme;
    [key: string]: DiagramStyleTheme | undefined;
  };
  customNodeStyles?: Record<string, {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
  }>;
}

export const defaultLightTheme: DiagramStyleTheme = {
  id: 'light',
  name: 'Light Mode',
  colors: {
    background: '#ffffff',
    swimlaneBackground: '#f8fafc',
    swimlaneBorder: '#cbd5e1',
    nodeBackground: '#ffffff',
    nodeBorder: '#94a3b8',
    nodeText: '#0f172a',
    edgeStroke: '#64748b',
    edgeLabel: '#475569',
    nodeTypes: {
      endpoint: { background: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
      process: { background: '#f1f5f9', border: '#94a3b8', text: '#0f172a' },
      decision: { background: '#fef3c7', border: '#fbbf24', text: '#78350f' },
      data: { background: '#dcfce7', border: '#4ade80', text: '#14532d' },
      custom: { background: '#f3e8ff', border: '#a855f7', text: '#581c87' }
    }
  },
  fonts: {
    nodeFont: 'system-ui, -apple-system, sans-serif',
    nodeFontSize: '14px',
    edgeFontSize: '12px'
  }
};

export const defaultDarkTheme: DiagramStyleTheme = {
  id: 'dark',
  name: 'Dark Mode',
  colors: {
    background: '#0f172a',
    swimlaneBackground: '#1e293b',
    swimlaneBorder: '#475569',
    nodeBackground: '#1e293b',
    nodeBorder: '#64748b',
    nodeText: '#f1f5f9',
    edgeStroke: '#94a3b8',
    edgeLabel: '#cbd5e1',
    nodeTypes: {
      endpoint: { background: '#1e3a8a', border: '#60a5fa', text: '#dbeafe' },
      process: { background: '#334155', border: '#94a3b8', text: '#f1f5f9' },
      decision: { background: '#78350f', border: '#fbbf24', text: '#fef3c7' },
      data: { background: '#14532d', border: '#4ade80', text: '#dcfce7' },
      custom: { background: '#581c87', border: '#a855f7', text: '#f3e8ff' }
    }
  },
  fonts: {
    nodeFont: 'system-ui, -apple-system, sans-serif',
    nodeFontSize: '14px',
    edgeFontSize: '12px'
  }
};
