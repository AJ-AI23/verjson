
import {
  createRootNode,
  createGroupNode,
  createArrayNode,
  createPropertyNode,
  createNestedPropertyNode,
  createArrayItemNode
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
          properties: 2,
          jsonPath: 'root'
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
      const x = 0;
      const y = 150;
      
      const groupNode = createGroupNode('root', properties, requiredProps, x, y);
      
      // Use regex to only check the beginning of the ID, since it now includes a UUID
      expect(groupNode.id).toMatch(/^group-root-/);
      expect(groupNode.type).toBe('schemaType');
      expect(groupNode.position).toEqual({ x: 0, y: 150 });
      expect(groupNode.data.label).toBe('root Properties');
      expect(groupNode.data.type).toBe('object');
      expect(groupNode.data.isGroup).toBe(true);
      expect(groupNode.data.propertyDetails).toHaveLength(2);
      expect(groupNode.data.propertyDetails[0].name).toBe('prop1');
      expect(groupNode.data.propertyDetails[0].required).toBe(true);
      expect(groupNode.data.propertyDetails[1].name).toBe('prop2');
      expect(groupNode.data.propertyDetails[1].required).toBe(false);
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
          maxItems: 10,
          jsonPath: 'group-id.items'
        }
      });
    });
  });
  
  describe('createNestedPropertyNode', () => {
    it('should create a nested property node with correct properties', () => {
      const propSchema = {
        type: 'string',
        description: 'A test property'
      };
      
      const node = createNestedPropertyNode('parent-id', 'testProp', propSchema, 150, true);
      
      expect(node).toEqual({
        id: 'parent-id-testProp',
        type: 'schemaType',
        position: { x: 0, y: 150 },
        data: {
          label: 'testProp',
          type: 'string',
          description: 'A test property',
          format: undefined,
          required: true,
          reference: undefined,
          jsonPath: 'parent-id.properties.testProp'
        }
      });
    });
  });
  
  describe('createArrayItemNode', () => {
    it('should create an array item node with correct properties', () => {
      const itemSchema = {
        type: 'object',
        description: 'Array item description'
      };
      
      const node = createArrayItemNode('array-id', itemSchema);
      
      expect(node).toEqual({
        id: 'array-id-items',
        type: 'schemaType',
        position: { x: 0, y: 300 },
        data: {
          label: 'Array Item',
          type: 'object',
          description: 'Array item description',
          jsonPath: 'array-id.items'
        }
      });
    });
  });
});
