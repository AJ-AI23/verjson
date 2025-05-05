
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock Jest functionality for tests
if (typeof jest !== 'undefined') {
  // Mock functions
  (global as any).jest = {
    fn: () => ({
      mockImplementation: (fn: Function) => fn
    }),
    mock: (path: string) => ({
      __esModule: true
    }),
    clearAllMocks: () => {}
  };
}

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
    const setNodes = () => {};
    const onNodesChange = () => {};
    return [nodes, setNodes, onNodesChange];
  },
  useEdgesState: () => {
    const edges: any[] = [];
    const setEdges = () => {};
    const onEdgesChange = () => {};
    return [edges, setEdges, onEdgesChange];
  },
}));
