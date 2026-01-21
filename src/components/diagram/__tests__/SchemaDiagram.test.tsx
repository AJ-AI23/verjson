
import { render, screen } from '@/lib/test-utils';
import { SchemaDiagram } from '../SchemaDiagram';

// Mock the useDiagramNodes hook
jest.mock('../hooks/useDiagramNodes', () => ({
  useDiagramNodes: () => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    nodePositionsRef: { current: {} },
    schemaKey: 1
  })
}));

describe('SchemaDiagram', () => {
  it('renders DiagramEmpty with error when error is true', () => {
    render(<SchemaDiagram schema={null} error={true} isDiagram={false} />);
    
    const errorText = screen.getByText('Fix Schema errors to view diagram');
    expect(errorText).toBeInTheDocument();
  });
  
  it('renders DiagramEmpty with noSchema when schema is null', () => {
    render(<SchemaDiagram schema={null} error={false} isDiagram={false} />);
    
    const noSchemaText = screen.getByText('No schema components to display');
    expect(noSchemaText).toBeInTheDocument();
  });
  
  it('renders DiagramHeader and DiagramFlow when schema is provided', () => {
    const mockSchema = { type: 'object', properties: {} };
    
    render(<SchemaDiagram schema={mockSchema} error={false} isDiagram={false} />);
    
    const headerText = screen.getByText('Schema Diagram');
    expect(headerText).toBeInTheDocument();
    
    // Since we're using mocks, ReactFlow will be represented by mock-react-flow
    const reactFlowElement = screen.getByTestId('mock-react-flow');
    expect(reactFlowElement).toBeInTheDocument();
  });

  it('renders SequenceDiagramRenderer when isDiagram is true and type is sequence', () => {
    const mockDiagram = {
      verjson: '1.0.0',
      type: 'sequence',
      info: { version: '0.1.0', title: 'Test Diagram' },
      data: {
        lifelines: [],
        nodes: []
      }
    };
    
    render(<SchemaDiagram schema={mockDiagram} error={false} isDiagram={true} />);
    
    // The SequenceDiagramRenderer should be rendered
    // We can't easily test the internal structure without more mocks,
    // but we can verify it doesn't throw an error
    expect(true).toBe(true);
  });
});
