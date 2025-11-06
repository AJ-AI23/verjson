import { DiagramDocument } from '@/types/diagram';
import { defaultLightTheme, defaultDarkTheme } from '@/types/diagramStyles';

export const defaultDiagramSchema: DiagramDocument = {
  version: '1.0.0',
  type: 'sequence',
  metadata: {
    title: 'New Sequence Diagram',
    description: 'A sequence diagram showing interactions between components',
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  },
  data: {
    lifelines: [
      {
        id: 'lifeline-1',
        name: 'User',
        order: 0,
        description: 'Client application or user interface',
        color: '#3b82f6'
      },
      {
        id: 'lifeline-2',
        name: 'Web Application',
        order: 1,
        description: 'Frontend web application',
        color: '#10b981'
      },
      {
        id: 'lifeline-3',
        name: 'Authorization Server',
        order: 2,
        description: 'OAuth2 authorization service',
        color: '#8b5cf6'
      },
      {
        id: 'lifeline-4',
        name: 'Resource Server',
        order: 3,
        description: 'Backend API service',
        color: '#f59e0b'
      }
    ],
    nodes: [
      {
        id: 'node-1',
        type: 'process',
        label: 'Click login link',
        lifelineId: 'lifeline-1',
        position: { x: 100, y: 140 },
        data: {
          description: 'User initiates login'
        }
      },
      {
        id: 'node-2',
        type: 'process',
        label: 'Authorization Code Request to /authorize',
        lifelineId: 'lifeline-2',
        position: { x: 100, y: 280 },
        data: {
          description: 'Request authorization code'
        }
      },
      {
        id: 'node-3',
        type: 'process',
        label: 'Redirect to login/authorization prompt',
        lifelineId: 'lifeline-3',
        position: { x: 100, y: 420 },
        data: {
          description: 'Show login screen'
        }
      },
      {
        id: 'node-4',
        type: 'process',
        label: 'Authenticate and consent',
        lifelineId: 'lifeline-1',
        position: { x: 100, y: 560 },
        data: {
          description: 'User provides credentials'
        }
      },
      {
        id: 'node-5',
        type: 'process',
        label: 'Authorization Code',
        lifelineId: 'lifeline-2',
        position: { x: 100, y: 700 },
        data: {
          description: 'Return authorization code'
        }
      },
      {
        id: 'node-6',
        type: 'process',
        label: 'Authorization Code + Client ID + Client Secret to /oauth/token endpoint',
        lifelineId: 'lifeline-3',
        position: { x: 100, y: 840 },
        data: {
          description: 'Exchange code for token'
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'sync'
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        type: 'sync'
      },
      {
        id: 'edge-3',
        source: 'node-3',
        target: 'node-4',
        type: 'return'
      },
      {
        id: 'edge-4',
        source: 'node-4',
        target: 'node-5',
        type: 'sync'
      },
      {
        id: 'edge-5',
        source: 'node-5',
        target: 'node-6',
        type: 'sync'
      }
    ],
    anchors: []
  },
  styles: {
    activeTheme: 'light',
    themes: {
      light: defaultLightTheme,
      dark: defaultDarkTheme
    }
  }
};

export const defaultFlowchartSchema: DiagramDocument = {
  version: '1.0.0',
  type: 'flowchart',
  metadata: {
    title: 'New Flowchart',
    description: 'A basic flowchart diagram',
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  },
  data: {
    nodes: [
      {
        id: 'node-1',
        type: 'process',
        label: 'Start',
        position: { x: 250, y: 50 },
        data: {
          description: 'Process starting point'
        }
      },
      {
        id: 'node-2',
        type: 'decision',
        label: 'Condition Check',
        position: { x: 250, y: 200 },
        data: {
          description: 'Decision point in the flow'
        }
      },
      {
        id: 'node-3',
        type: 'process',
        label: 'Process A',
        position: { x: 100, y: 350 },
        data: {
          description: 'First processing branch'
        }
      },
      {
        id: 'node-4',
        type: 'process',
        label: 'Process B',
        position: { x: 400, y: 350 },
        data: {
          description: 'Second processing branch'
        }
      },
      {
        id: 'node-5',
        type: 'process',
        label: 'End',
        position: { x: 250, y: 500 },
        data: {
          description: 'Process ending point'
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'default'
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        label: 'Yes',
        type: 'default'
      },
      {
        id: 'edge-3',
        source: 'node-2',
        target: 'node-4',
        label: 'No',
        type: 'default'
      },
      {
        id: 'edge-4',
        source: 'node-3',
        target: 'node-5',
        type: 'default'
      },
      {
        id: 'edge-5',
        source: 'node-4',
        target: 'node-5',
        type: 'default'
      }
    ]
  },
  styles: {
    activeTheme: 'light',
    themes: {
      light: defaultLightTheme,
      dark: defaultDarkTheme
    }
  }
};
