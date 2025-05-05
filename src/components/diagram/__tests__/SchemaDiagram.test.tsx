
import { render, screen } from '@/lib/test-utils';
import { SchemaDiagram } from '../SchemaDiagram';

// Mock the useDiagramNodes hook
(jest as any).mock('../hooks/useDiagramNodes', () => ({
  useDiagramNodes: () => ({
    nodes: [],
    edges: [],
    onNodesChange: (jest as any).fn(),
    onEdgesChange: (jest as any).fn(),
    nodePositionsRef: { current: {} },
    schemaKey: 1
  })
}));

describe('SchemaDiagram', () => {
  it('renders DiagramEmpty with error when error is true', () => {
    render(<SchemaDiagram schema={null} error={true} />);
    
    const errorText = screen.getByText('Fix Schema errors to view diagram');
    (expect as any)(errorText).toBeInTheDocument();
  });
  
  it('renders DiagramEmpty with noSchema when schema is null', () => {
    render(<SchemaDiagram schema={null} error={false} />);
    
    const noSchemaText = screen.getByText('No schema components to display');
    (expect as any)(noSchemaText).toBeInTheDocument();
  });
  
  it('renders DiagramHeader and DiagramFlow when schema is provided', () => {
    const mockSchema = { type: 'object', properties: {} };
    
    render(<SchemaDiagram schema={mockSchema} error={false} />);
    
    const headerText = screen.getByText('Schema Diagram');
    (expect as any)(headerText).toBeInTheDocument();
    
    // Since we're using mocks, ReactFlow will be represented by mock-react-flow
    const reactFlowElement = screen.getByTestId('mock-react-flow');
    (expect as any)(reactFlowElement).toBeInTheDocument();
  });
});
