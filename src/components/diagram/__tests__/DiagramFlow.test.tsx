
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
});
