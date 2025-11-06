import { DiagramDocument } from '@/types/diagram';

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
    swimlanes: [
      {
        id: 'swimlane-1',
        name: 'Client',
        color: '#3b82f6',
        order: 0,
        description: 'Client application or user interface'
      },
      {
        id: 'swimlane-2',
        name: 'API Gateway',
        color: '#10b981',
        order: 1,
        description: 'API Gateway layer'
      },
      {
        id: 'swimlane-3',
        name: 'Backend Service',
        color: '#8b5cf6',
        order: 2,
        description: 'Backend business logic'
      }
    ],
    columns: [
      {
        id: 'column-1',
        name: 'Request Phase',
        order: 0,
        width: 300,
        description: 'Initial request handling'
      },
      {
        id: 'column-2',
        name: 'Processing Phase',
        order: 1,
        width: 300,
        description: 'Data processing and business logic'
      },
      {
        id: 'column-3',
        name: 'Response Phase',
        order: 2,
        width: 300,
        description: 'Response generation and delivery'
      }
    ],
    nodes: [
      {
        id: 'node-1',
        type: 'process',
        label: 'User Login Request',
        swimlaneId: 'swimlane-1',
        columnId: 'column-1',
        position: { x: 100, y: 100 },
        data: {
          description: 'User initiates login with credentials'
        }
      },
      {
        id: 'node-2',
        type: 'endpoint',
        label: 'POST /auth/login',
        swimlaneId: 'swimlane-2',
        columnId: 'column-1',
        position: { x: 100, y: 200 },
        data: {
          method: 'POST',
          path: '/auth/login',
          description: 'Authentication endpoint'
        }
      },
      {
        id: 'node-3',
        type: 'process',
        label: 'Validate Credentials',
        swimlaneId: 'swimlane-3',
        columnId: 'column-2',
        position: { x: 100, y: 300 },
        data: {
          description: 'Check username and password against database'
        }
      },
      {
        id: 'node-4',
        type: 'decision',
        label: 'Valid Credentials?',
        swimlaneId: 'swimlane-3',
        columnId: 'column-2',
        position: { x: 100, y: 400 },
        data: {
          description: 'Decision point for authentication'
        }
      },
      {
        id: 'node-5',
        type: 'process',
        label: 'Generate Token',
        swimlaneId: 'swimlane-3',
        columnId: 'column-3',
        position: { x: 100, y: 500 },
        data: {
          description: 'Create JWT token for authenticated session'
        }
      },
      {
        id: 'node-6',
        type: 'process',
        label: 'Return Success',
        swimlaneId: 'swimlane-1',
        columnId: 'column-3',
        position: { x: 100, y: 600 },
        data: {
          description: 'Return authentication token to client'
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Submit credentials',
        type: 'sync'
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        label: 'Forward request',
        type: 'sync'
      },
      {
        id: 'edge-3',
        source: 'node-3',
        target: 'node-4',
        type: 'default'
      },
      {
        id: 'edge-4',
        source: 'node-4',
        target: 'node-5',
        label: 'Yes',
        type: 'default'
      },
      {
        id: 'edge-5',
        source: 'node-5',
        target: 'node-6',
        label: 'Token + 200 OK',
        type: 'return'
      }
    ]
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
  }
};
