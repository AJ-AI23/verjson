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
  selectedTheme: 'light',
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
        anchors: [
          { id: 'anchor-1', lifelineId: 'lifeline-1', anchorType: 'source' },
          { id: 'anchor-2', lifelineId: 'lifeline-2', anchorType: 'target' }
        ],
        yPosition: 140,
        data: {
          description: 'User initiates login'
        }
      },
      {
        id: 'node-2',
        type: 'process',
        label: 'Authorization Code Request to /authorize',
        anchors: [
          { id: 'anchor-3', lifelineId: 'lifeline-2', anchorType: 'source' },
          { id: 'anchor-4', lifelineId: 'lifeline-3', anchorType: 'target' }
        ],
        yPosition: 280,
        data: {
          description: 'Request authorization code'
        }
      },
      {
        id: 'node-3',
        type: 'process',
        label: 'Redirect to login/authorization prompt',
        anchors: [
          { id: 'anchor-5', lifelineId: 'lifeline-3', anchorType: 'source' },
          { id: 'anchor-6', lifelineId: 'lifeline-1', anchorType: 'target' }
        ],
        yPosition: 420,
        data: {
          description: 'Show login screen'
        }
      },
      {
        id: 'node-4',
        type: 'process',
        label: 'Authenticate and consent',
        anchors: [
          { id: 'anchor-7', lifelineId: 'lifeline-1', anchorType: 'source' },
          { id: 'anchor-8', lifelineId: 'lifeline-3', anchorType: 'target' }
        ],
        yPosition: 560,
        data: {
          description: 'User provides credentials'
        }
      },
      {
        id: 'node-5',
        type: 'process',
        label: 'Authorization Code',
        anchors: [
          { id: 'anchor-9', lifelineId: 'lifeline-3', anchorType: 'source' },
          { id: 'anchor-10', lifelineId: 'lifeline-2', anchorType: 'target' }
        ],
        yPosition: 700,
        data: {
          description: 'Return authorization code'
        }
      },
      {
        id: 'node-6',
        type: 'process',
        label: 'Authorization Code + Client ID + Client Secret to /oauth/token endpoint',
        anchors: [
          { id: 'anchor-11', lifelineId: 'lifeline-2', anchorType: 'source' },
          { id: 'anchor-12', lifelineId: 'lifeline-3', anchorType: 'target' }
        ],
        yPosition: 840,
        data: {
          description: 'Exchange code for token'
        }
      }
    ],
    processes: [
      {
        id: 'process-1',
        type: 'lifelineProcess',
        lifelineId: 'lifeline-1',
        anchorIds: ['anchor-1', 'anchor-7'],
        description: 'User Authentication Flow',
        parallelIndex: 0
      },
      {
        id: 'process-2',
        type: 'lifelineProcess',
        lifelineId: 'lifeline-3',
        anchorIds: ['anchor-4', 'anchor-12'],
        description: 'OAuth Authorization',
        parallelIndex: 0
      }
    ]
  },
  styles: {
    themes: {
      light: {
        ...defaultLightTheme,
        lifelineColors: {
          'lifeline-1': {
            background: '#dbeafe',
            anchorColor: '#93c5fd',
            anchorBorder: '#60a5fa',
            processColor: 'rgba(147, 197, 253, 0.3)'
          },
          'lifeline-2': {
            background: '#d1fae5',
            anchorColor: '#6ee7b7',
            anchorBorder: '#34d399',
            processColor: 'rgba(110, 231, 183, 0.3)'
          },
          'lifeline-3': {
            background: '#ede9fe',
            anchorColor: '#c4b5fd',
            anchorBorder: '#a78bfa',
            processColor: 'rgba(196, 181, 253, 0.3)'
          },
          'lifeline-4': {
            background: '#fed7aa',
            anchorColor: '#fdba74',
            anchorBorder: '#fb923c',
            processColor: 'rgba(253, 186, 116, 0.3)'
          }
        }
      },
      dark: {
        ...defaultDarkTheme,
        lifelineColors: {
          'lifeline-1': {
            background: '#1e3a8a',
            anchorColor: '#3b82f6',
            anchorBorder: '#60a5fa',
            processColor: 'rgba(59, 130, 246, 0.3)'
          },
          'lifeline-2': {
            background: '#065f46',
            anchorColor: '#10b981',
            anchorBorder: '#34d399',
            processColor: 'rgba(16, 185, 129, 0.3)'
          },
          'lifeline-3': {
            background: '#5b21b6',
            anchorColor: '#8b5cf6',
            anchorBorder: '#a78bfa',
            processColor: 'rgba(139, 92, 246, 0.3)'
          },
          'lifeline-4': {
            background: '#92400e',
            anchorColor: '#f59e0b',
            anchorBorder: '#fb923c',
            processColor: 'rgba(245, 158, 11, 0.3)'
          }
        }
      }
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
  selectedTheme: 'light',
  data: {
    nodes: [],
    edges: []
  },
  styles: {
    themes: {
      light: defaultLightTheme,
      dark: defaultDarkTheme
    }
  }
};
