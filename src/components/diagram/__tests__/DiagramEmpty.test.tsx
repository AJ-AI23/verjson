
import { render, screen } from '@testing-library/react';
import { DiagramEmpty } from '../DiagramEmpty';

describe('DiagramEmpty', () => {
  it('renders error message when error is true', () => {
    render(<DiagramEmpty error={true} />);
    
    const errorText = screen.getByText('Fix Schema errors to view diagram');
    expect(errorText).toBeInTheDocument();
  });
  
  it('renders no schema message when noSchema is true', () => {
    render(<DiagramEmpty noSchema={true} />);
    
    const noSchemaText = screen.getByText('No schema components to display');
    expect(noSchemaText).toBeInTheDocument();
  });
  
  it('renders the header with schema diagram text', () => {
    render(<DiagramEmpty />);
    
    const headerText = screen.getByText('Schema Diagram');
    expect(headerText).toBeInTheDocument();
  });
  
  it('renders no schema message by default', () => {
    render(<DiagramEmpty />);
    
    const noSchemaText = screen.getByText('No schema components to display');
    expect(noSchemaText).toBeInTheDocument();
  });
});
