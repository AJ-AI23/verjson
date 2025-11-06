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
  };
  fonts: {
    nodeFont: string;
    nodeFontSize: string;
    edgeFontSize: string;
  };
}

export interface DiagramStyles {
  activeTheme: string;
  themes: {
    light: DiagramStyleTheme;
    dark: DiagramStyleTheme;
    [key: string]: DiagramStyleTheme;
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
    edgeLabel: '#475569'
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
    edgeLabel: '#cbd5e1'
  },
  fonts: {
    nodeFont: 'system-ui, -apple-system, sans-serif',
    nodeFontSize: '14px',
    edgeFontSize: '12px'
  }
};
