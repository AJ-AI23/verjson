
import React from 'react';
import { SchemaDiagram as DiagramComponent } from './diagram/SchemaDiagram';

/**
 * Schema Diagram Component
 * 
 * Note: This component exists for backward compatibility.
 * Please use the new component at './diagram/SchemaDiagram' for new code.
 */
export const SchemaDiagram = (props: {
  schema: any;
  error: boolean;
  groupProperties?: boolean;
}) => {
  return <DiagramComponent {...props} />;
};
