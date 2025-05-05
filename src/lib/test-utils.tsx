
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Ensure Jest mock functions are available for tests
if (typeof jest !== 'undefined') {
  // Make sure common Jest utilities are available
  if (!jest.fn) {
    (jest as any).fn = (implementation?: any) => {
      const mockFn = implementation || (() => {});
      mockFn.mockImplementation = (fn: any) => fn;
      mockFn.mockReturnValue = (val: any) => {
        mockFn.implementation = () => val;
        return mockFn;
      };
      return mockFn;
    };
  }
  
  if (!jest.mock) {
    (jest as any).mock = (path: string) => ({
      __esModule: true
    });
  }
  
  if (!jest.clearAllMocks) {
    (jest as any).clearAllMocks = () => {};
  }

  // Add timer-related functions
  if (!jest.useFakeTimers) {
    (jest as any).useFakeTimers = () => {};
  }
  
  if (!jest.useRealTimers) {
    (jest as any).useRealTimers = () => {};
  }
  
  if (!jest.runAllTimers) {
    (jest as any).runAllTimers = () => {};
  }
}

// Mock ReactFlow to avoid errors in tests
jest.mock('@xyflow/react', () => ({
  __esModule: true,
  ReactFlow: ({ children, onInit, onMove, onMoveEnd }: { 
    children: React.ReactNode, 
    onInit?: (instance: any) => void,
    onMove?: (event: any) => void,
    onMoveEnd?: (event: any) => void
  }) => {
    // Call onInit with a mock instance if provided
    if (onInit) {
      const mockInstance = {
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        setViewport: jest.fn()
      };
      setTimeout(() => onInit(mockInstance), 0);
    }
    return <div data-testid="mock-react-flow">{children}</div>;
  },
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
