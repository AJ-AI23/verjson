
import {
  createRootNode,
  createGroupNode,
  createArrayNode,
  createPropertyNode,
  createNestedPropertyNode,
  createArrayItemNode,
  createParametersNode,
  createTagsNode,
  createSecurityNode
} from '../nodeGenerator';

describe('Node Generators', () => {
  describe('createRootNode', () => {
    it('should create a root node with correct properties', () => {
      const schema = {
        title: 'Test Schema',
        type: 'object',
        description: 'Test description',
        properties: {
          prop1: {},
          prop2: {}
        }
      };
      
      const rootNode = createRootNode(schema);
      
      expect(rootNode).toEqual({
        id: 'root',
        type: 'schemaType',
        position: { x: 0, y: 0 },
        data: {
          label: 'Test Schema',
          type: 'object',
          description: 'Test description',
          isRoot: true,
          properties: 2
        }
      });
    });
    
    it('should use default title if not provided', () => {
      const schema = {
        type: 'object',
      };
      
      const rootNode = createRootNode(schema);
      
      expect(rootNode.data.label).toBe('Root Schema');
    });
  });
  
  describe('createGroupNode', () => {
    it('should create a group node with correct properties', () => {
      const properties = {
        prop1: { type: 'string' },
        prop2: { type: 'number' }
      };
      const requiredProps = ['prop1'];
      const yPosition = 150;
      
      const groupNode = createGroupNode('root', properties, requiredProps, yPosition);
      
      expect(groupNode).toEqual({
        id: 'props',
        type: 'schemaType',
        position: { x: 0, y: 150 },
        data: {
          label: 'Properties',
          type: 'object',
          isGroup: true,
          properties: 2,
          propertyDetails: [
            {
              name: 'prop1',
              type: 'string',
              required: true,
              format: undefined,
              description: undefined,
              reference: undefined
            },
            {
              name: 'prop2',
              type: 'number',
              required: false,
              format: undefined,
              description: undefined,
              reference: undefined
            }
          ]
        }
      });
    });
    
    it('should create nested group node with correct ID', () => {
      const properties = { prop1: {} };
      const requiredProps: string[] = [];
      const yPosition = 150;
      
      const groupNode = createGroupNode('parent-id', properties, requiredProps, yPosition);
      
      expect(groupNode.id).toBe('parent-id-props');
      expect(groupNode.data.label).toBe('Nested Properties');
    });
  });
  
  describe('createArrayNode', () => {
    it('should create an array node with correct properties', () => {
      const propSchema = {
        type: 'array',
        minItems: 1,
        maxItems: 10
      };
      
      const arrayNode = createArrayNode('group-id', 'items', propSchema, 200);
      
      expect(arrayNode).toEqual({
        id: 'group-id-items-array',
        type: 'schemaType',
        position: { x: -200, y: 200 },
        data: {
          label: 'items (Array)',
          type: 'array',
          minItems: 1,
          maxItems: 10
        }
      });
    });
  });
  
  // Add more tests for other node generators
});
