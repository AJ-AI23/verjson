
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock ReactFlow to avoid errors in tests
jest.mock('@xyflow/react', () => ({
  __esModule: true,
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-react-flow">{children}</div>,
  Background: () => <div data-testid="mock-background" />,
  Controls: () => <div data-testid="mock-controls" />,
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`mock-handle-${type}-${position}`} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  useNodesState: () => {
    const nodes: any[] = [];
    const setNodes = jest.fn();
    const onNodesChange = jest.fn();
    return [nodes, setNodes, onNodesChange];
  },
  useEdgesState: () => {
    const edges: any[] = [];
    const setEdges = jest.fn();
    const onEdgesChange = jest.fn();
    return [edges, setEdges, onEdgesChange];
  },
}));
