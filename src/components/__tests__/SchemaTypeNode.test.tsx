
import { render, screen } from '@/lib/test-utils';
import { SchemaTypeNode } from '../SchemaTypeNode';

describe('SchemaTypeNode', () => {
  const defaultProps = {
    data: {
      label: 'Test Node',
      type: 'string'
    },
    id: 'test-node',
    isConnectable: true
  };
  
  it('renders the node label', () => {
    render(<SchemaTypeNode {...defaultProps} />);
    
    const labelElement = screen.getByText('Test Node');
    expect(labelElement).toBeInTheDocument();
  });
  
  it('renders the type badge', () => {
    render(<SchemaTypeNode {...defaultProps} />);
    
    const typeBadge = screen.getByText('string');
    expect(typeBadge).toBeInTheDocument();
    expect(typeBadge).toHaveClass('bg-blue-100');
  });
  
  it('renders description when provided', () => {
    const propsWithDescription = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        description: 'Test description'
      }
    };
    
    render(<SchemaTypeNode {...propsWithDescription} />);
    
    const descriptionElement = screen.getByText('Test description');
    expect(descriptionElement).toBeInTheDocument();
  });
  
  it('renders format when provided', () => {
    const propsWithFormat = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        format: 'email'
      }
    };
    
    render(<SchemaTypeNode {...propsWithFormat} />);
    
    const formatElement = screen.getByText('format:');
    expect(formatElement).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });
  
  it('renders properties count when provided', () => {
    const propsWithProperties = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        properties: 5
      }
    };
    
    render(<SchemaTypeNode {...propsWithProperties} />);
    
    const propertiesElement = screen.getByText('properties:');
    expect(propertiesElement).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  
  it('renders required indicator when required is true', () => {
    const propsWithRequired = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        required: true
      }
    };
    
    render(<SchemaTypeNode {...propsWithRequired} />);
    
    const requiredElement = screen.getByText('Required');
    expect(requiredElement).toBeInTheDocument();
  });
  
  it('renders handles for object type', () => {
    const propsWithObjectType = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        type: 'object'
      }
    };
    
    render(<SchemaTypeNode {...propsWithObjectType} />);
    
    // Target handle should always be rendered for non-root nodes
    const targetHandle = screen.getByTestId('mock-handle-target-top');
    expect(targetHandle).toBeInTheDocument();
    
    // Source handle should be rendered for object type
    const sourceHandle = screen.getByTestId('mock-handle-source-bottom');
    expect(sourceHandle).toBeInTheDocument();
  });
});
