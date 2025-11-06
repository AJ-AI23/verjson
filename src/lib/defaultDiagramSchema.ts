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
        anchors: [
          { lifelineId: 'lifeline-1', id: 'anchor-1-source' },
          { lifelineId: 'lifeline-2', id: 'anchor-1-target' }
        ],
        position: { x: 100, y: 140 },
        data: {
          description: 'User initiates login'
        }
      },
      {
        id: 'node-2',
        type: 'process',
        label: 'Authorization Code Request to /authorize',
        anchors: [
          { lifelineId: 'lifeline-2', id: 'anchor-2-source' },
          { lifelineId: 'lifeline-3', id: 'anchor-2-target' }
        ],
        position: { x: 100, y: 280 },
        data: {
          description: 'Request authorization code'
        }
      },
      {
        id: 'node-3',
        type: 'process',
        label: 'Redirect to login/authorization prompt',
        anchors: [
          { lifelineId: 'lifeline-3', id: 'anchor-3-source' },
          { lifelineId: 'lifeline-1', id: 'anchor-3-target' }
        ],
        position: { x: 100, y: 420 },
        data: {
          description: 'Show login screen'
        }
      },
      {
        id: 'node-4',
        type: 'process',
        label: 'Authenticate and consent',
        anchors: [
          { lifelineId: 'lifeline-1', id: 'anchor-4-source' },
          { lifelineId: 'lifeline-3', id: 'anchor-4-target' }
        ],
        position: { x: 100, y: 560 },
        data: {
          description: 'User provides credentials'
        }
      },
      {
        id: 'node-5',
        type: 'process',
        label: 'Authorization Code',
        anchors: [
          { lifelineId: 'lifeline-3', id: 'anchor-5-source' },
          { lifelineId: 'lifeline-2', id: 'anchor-5-target' }
        ],
        position: { x: 100, y: 700 },
        data: {
          description: 'Return authorization code'
        }
      },
      {
        id: 'node-6',
        type: 'process',
        label: 'Authorization Code + Client ID + Client Secret to /oauth/token endpoint',
        anchors: [
          { lifelineId: 'lifeline-2', id: 'anchor-6-source' },
          { lifelineId: 'lifeline-3', id: 'anchor-6-target' }
        ],
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
    anchors: [
      { id: 'anchor-1-source', lifelineId: 'lifeline-1', yPosition: 140, connectedNodeId: 'node-1', anchorType: 'source' },
      { id: 'anchor-1-target', lifelineId: 'lifeline-2', yPosition: 140, connectedNodeId: 'node-1', anchorType: 'target' },
      { id: 'anchor-2-source', lifelineId: 'lifeline-2', yPosition: 280, connectedNodeId: 'node-2', anchorType: 'source' },
      { id: 'anchor-2-target', lifelineId: 'lifeline-3', yPosition: 280, connectedNodeId: 'node-2', anchorType: 'target' },
      { id: 'anchor-3-source', lifelineId: 'lifeline-3', yPosition: 420, connectedNodeId: 'node-3', anchorType: 'source' },
      { id: 'anchor-3-target', lifelineId: 'lifeline-1', yPosition: 420, connectedNodeId: 'node-3', anchorType: 'target' },
      { id: 'anchor-4-source', lifelineId: 'lifeline-1', yPosition: 560, connectedNodeId: 'node-4', anchorType: 'source' },
      { id: 'anchor-4-target', lifelineId: 'lifeline-3', yPosition: 560, connectedNodeId: 'node-4', anchorType: 'target' },
      { id: 'anchor-5-source', lifelineId: 'lifeline-3', yPosition: 700, connectedNodeId: 'node-5', anchorType: 'source' },
      { id: 'anchor-5-target', lifelineId: 'lifeline-2', yPosition: 700, connectedNodeId: 'node-5', anchorType: 'target' },
      { id: 'anchor-6-source', lifelineId: 'lifeline-2', yPosition: 840, connectedNodeId: 'node-6', anchorType: 'source' },
      { id: 'anchor-6-target', lifelineId: 'lifeline-3', yPosition: 840, connectedNodeId: 'node-6', anchorType: 'target' }
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
    nodes: [],
    edges: []
  },
  styles: {
    activeTheme: 'light',
    themes: {
      light: defaultLightTheme,
      dark: defaultDarkTheme
    }
  }
};
