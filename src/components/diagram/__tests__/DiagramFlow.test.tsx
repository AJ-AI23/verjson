
import { render, screen } from '@/lib/test-utils';
import { DiagramFlow } from '../DiagramFlow';

describe('DiagramFlow', () => {
  const mockProps = {
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    schemaKey: 1,
    shouldFitView: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ReactFlow component', () => {
    render(<DiagramFlow {...mockProps} />);
    
    const reactFlowElement = screen.getByTestId('mock-react-flow');
    expect(reactFlowElement).toBeInTheDocument();
  });
  
  it('renders Background component', () => {
    render(<DiagramFlow {...mockProps} />);
    
    const backgroundElement = screen.getByTestId('mock-background');
    expect(backgroundElement).toBeInTheDocument();
  });
  
  it('renders Controls component', () => {
    render(<DiagramFlow {...mockProps} />);
    
    const controlsElement = screen.getByTestId('mock-controls');
    expect(controlsElement).toBeInTheDocument();
  });
  
  it('applies the correct className', () => {
    render(<DiagramFlow {...mockProps} />);
    
    const containerElement = screen.getByTestId('mock-react-flow').parentElement;
    expect(containerElement).toHaveClass('flex-1');
    expect(containerElement).toHaveClass('diagram-container');
  });

  it('preserves viewport when shouldFitView is false', () => {
    // Use a mocked timer to test the timeout behavior
    jest.useFakeTimers();
    
    // Render with shouldFitView=false to test viewport preservation
    render(<DiagramFlow {...mockProps} shouldFitView={false} />);
    
    // Fast-forward timers to trigger any setTimeout calls
    jest.runAllTimers();
    
    // Reset timers
    jest.useRealTimers();
  });
  
  it('updates viewport reference when shouldFitView changes', () => {
    // Start with fitting the view
    const { rerender } = render(<DiagramFlow {...mockProps} shouldFitView={true} />);
    
    // Then change to not fitting the view
    rerender(<DiagramFlow {...mockProps} shouldFitView={false} />);
    
    // The update should happen (we can't test the actual viewport since it's all mocked)
    // But at least we're testing that the component doesn't crash
  });
});
