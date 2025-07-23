
import { render, screen } from '@testing-library/react';
import { DiagramHeader } from '../DiagramHeader';

describe('DiagramHeader', () => {
  it('renders the header with schema diagram text', () => {
    render(<DiagramHeader />);
    
    const headerText = screen.getByText('Schema Diagram');
    expect(headerText).toBeInTheDocument();
  });
  
  it('has the correct styling', () => {
    render(<DiagramHeader />);
    
    const headerDiv = screen.getByText('Schema Diagram').parentElement;
    expect(headerDiv).toHaveClass('p-2');
    expect(headerDiv).toHaveClass('border-b');
    expect(headerDiv).toHaveClass('bg-slate-50');
  });
});
