import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentationViewerProps {
  docPath: string;
  title: string;
}

// Sample documentation content - in a real app this would be loaded from files
const sampleDocs: Record<string, string> = {
  '/docs/getting-started.md': `# Getting Started

Welcome to the JSON Schema Editor! This powerful tool helps you create, visualize, and manage JSON schemas with ease.

## Quick Start

1. **Create a new schema**: Start with a blank schema or use one of our templates
2. **Edit your schema**: Use the Monaco editor with full JSON Schema validation
3. **Visualize**: Switch to diagram view to see your schema structure
4. **Collaborate**: Share your schemas with team members

## Basic Features

### Schema Editor
- Full JSON Schema validation
- Auto-completion and syntax highlighting
- Real-time error detection
- Format code with Ctrl+F

### Diagram View
- Visual representation of your schema
- Interactive nodes showing relationships
- Expandable/collapsible structure
- Different layout options

### Workspace Management
- Organize schemas in workspaces
- Invite collaborators
- Version control and history
- Export and import capabilities

## Next Steps

- Check out the [Schema Editor Guide](/docs/schema-editor.md)
- Learn about [Diagram Visualization](/docs/diagram-view.md)
- Explore [Collaboration Features](/docs/collaboration.md)
`,

  '/docs/schema-editor.md': `# Schema Editor Guide

The JSON Schema Editor provides a powerful editing experience with advanced features for creating and maintaining JSON schemas.

## Editor Features

### Syntax Highlighting
The editor provides full syntax highlighting for JSON Schema with:
- Keywords highlighted in blue
- Strings in green  
- Numbers in orange
- Comments in gray

### Auto-completion
Press \`Ctrl+Space\` to trigger auto-completion:
- Schema keywords (\`properties\`, \`type\`, \`required\`, etc.)
- Common patterns and structures
- Valid enum values

### Validation
Real-time validation shows:
- Syntax errors with red underlines
- Schema validation issues
- Missing required properties
- Type mismatches

## Schema Structure

### Basic Types
\`\`\`json
{
  "type": "string",
  "minLength": 1,
  "maxLength": 100
}
\`\`\`

### Objects
\`\`\`json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number", "minimum": 0 }
  },
  "required": ["name"]
}
\`\`\`

### Arrays
\`\`\`json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10
}
\`\`\`

## Advanced Features

### References
Use \`$ref\` to reference other parts of your schema:
\`\`\`json
{
  "definitions": {
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" }
      }
    }
  },
  "properties": {
    "billing": { "$ref": "#/definitions/address" },
    "shipping": { "$ref": "#/definitions/address" }
  }
}
\`\`\`

### Conditional Schemas
Use \`if\`, \`then\`, \`else\` for conditional validation:
\`\`\`json
{
  "if": { "properties": { "type": { "const": "premium" } } },
  "then": { "required": ["premium_features"] },
  "else": { "not": { "required": ["premium_features"] } }
}
\`\`\`

## Tips and Tricks

- Use \`Ctrl+F\` to format your JSON
- Use \`Ctrl+/\` to toggle comments
- Use \`Alt+Click\` for multi-cursor editing
- Use \`Ctrl+D\` to select next occurrence of current word
`,

  '/docs/diagram-view.md': `# Diagram Visualization

The diagram view provides a visual representation of your JSON schema, making it easier to understand complex structures and relationships.

## Layout Options

### Grouped Properties
Groups related properties together for cleaner visualization:
- Similar types are clustered
- Reduces visual complexity
- Better for large schemas

### Expanded View
Shows all properties individually:
- Full detail visibility
- Better for smaller schemas
- Easier to see all relationships

## Node Types

### Root Node
- Represents the main schema object
- Shows schema title and description
- Entry point for the entire structure

### Property Nodes
- Individual schema properties
- Color-coded by type:
  - **Blue**: Strings
  - **Green**: Numbers
  - **Purple**: Booleans
  - **Orange**: Arrays
  - **Gray**: Objects

### Array Nodes
- Special handling for array types
- Shows item schema structure
- Indicates min/max items if specified

## Interactive Features

### Expand/Collapse
- Click nodes to expand or collapse
- Manages complex schema visibility
- Remembers state across sessions

### Zoom and Pan
- Mouse wheel to zoom
- Click and drag to pan
- Fit view button to reset

### Node Details
- Hover over nodes for quick info
- Click for detailed properties
- Shows validation rules and constraints

## Diagram Controls

### Toolbar Options
- **Fullscreen**: Maximize diagram area
- **Fit View**: Reset zoom and position
- **Layout**: Switch between grouped/expanded
- **Export**: Save diagrams as images

### Keyboard Shortcuts
- \`Space + Drag\`: Pan around the diagram
- \`+/-\`: Zoom in/out
- \`0\`: Fit view
- \`F\`: Toggle fullscreen

## Best Practices

### Large Schemas
- Use grouped view for overview
- Collapse unnecessary sections
- Focus on specific areas of interest

### Documentation
- Add descriptions to your schemas
- Use meaningful property names
- Include examples where helpful

### Navigation
- Use the minimap for large diagrams
- Bookmark important nodes
- Use search to find specific properties
`,

  '/docs/collaboration.md': `# Collaboration Features

Work effectively with your team using the built-in collaboration features.

## Workspaces

### Creating Workspaces
1. Click "New Workspace" from the dashboard
2. Enter workspace name and description
3. Set visibility (private/public)
4. Invite initial members

### Managing Workspaces
- **Settings**: Configure workspace preferences
- **Members**: Manage user permissions
- **Billing**: Handle subscription and usage
- **Archive**: Remove unused workspaces

## Permissions

### Role Types
- **Owner**: Full access including deletion
- **Admin**: Manage members and settings
- **Editor**: Create and modify schemas
- **Viewer**: Read-only access

### Document-Level Permissions
- Override workspace permissions
- Grant specific access to individual schemas
- Temporary access for external reviewers

## Real-time Collaboration

### Live Editing
- See other users' cursors in real-time
- Automatic conflict resolution
- Change indicators and highlights

### Comments and Reviews
- Add comments to specific schema sections
- Mention team members with @username
- Resolve discussions when complete

## Version Control

### Automatic Versioning
- Every save creates a new version
- Compare versions side-by-side
- Restore to any previous version

### Manual Snapshots
- Create named versions for releases
- Tag important milestones
- Branch for experimental changes

## Sharing and Export

### Public Links
- Share read-only links externally
- Set expiration dates
- Password protection available

### Export Options
- JSON Schema files
- Documentation (PDF/HTML)
- Diagram images
- Bulk export for backups

## Notifications

### Activity Feed
- Schema changes and updates
- New comments and mentions
- Workspace invitations
- System announcements

### Email Notifications
- Daily/weekly digest options
- Immediate alerts for mentions
- Customizable notification preferences

## Integration

### API Access
- RESTful API for automation
- Webhook notifications
- CI/CD pipeline integration

### Version Control Systems
- Git repository sync
- Automatic commits on changes
- Branch-based workflows
`,

  '/docs/confluence-integration.md': `# Confluence Plugin Integration

Embed your schema documents directly into Confluence pages with our Atlassian Forge plugin.

## Overview

The Schema Document Confluence Plugin allows you to seamlessly integrate your JSON schemas into Confluence documentation. This powerful integration enables teams to:

- **Embed Live Schemas**: Display up-to-date schema content in Confluence pages
- **Multiple Display Formats**: Choose between formatted, raw JSON, or compact views
- **Automatic Updates**: Schema changes are reflected immediately in Confluence
- **Team Collaboration**: Share schemas in context with your documentation

## Installation

### Method 1: Using Forge CLI (Recommended for Development)

1. **Install the Forge CLI:**
   \`\`\`bash
   npm install -g @forge/cli
   \`\`\`

2. **Create a new Forge app:**
   \`\`\`bash
   forge create --template custom-ui
   \`\`\`

3. **Replace the generated files** with the files from the \`public/confluence/\` directory

4. **Deploy and install:**
   \`\`\`bash
   forge deploy
   forge install
   \`\`\`

### Method 2: Self-Hosted Installation

1. **Host the plugin files** on your domain (they're already in your public folder)
2. **Create a Forge app manifest** that points to your hosted files
3. **Use the plugin configuration endpoint** for dynamic setup

## Configuration

### Environment Variables

Set these in your Supabase edge functions:

- \`APP_BASE_URL\`: Your application's base URL
- \`SUPABASE_URL\`: Your Supabase project URL  
- \`SUPABASE_SERVICE_ROLE_KEY\`: Service role key for database access

### Plugin Endpoints

The plugin uses these API endpoints:

- \`GET /functions/v1/public-document?id={documentId}&format=confluence&metadata=true\`
- \`GET /functions/v1/plugin-config?type=manifest\`
- \`GET /functions/v1/plugin-config?type=endpoints\`

## Usage in Confluence

### Adding the Macro

1. **Edit a Confluence page** or create a new one
2. **Type \`/\` to open the macro browser** or use the insert menu
3. **Search for "Schema Document"** and select it
4. **Configure the macro** with your desired settings

### Macro Configuration

#### Required Settings
- **Document ID**: The unique identifier of your schema document
  - Find this in your schema document URL
  - Format: \`doc_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\`

#### Display Options
- **Display Format**:
  - \`formatted\`: Styled JSON with syntax highlighting
  - \`raw\`: Plain text JSON
  - \`compact\`: Condensed view for large schemas

- **Show Metadata**: Include document name, workspace, and last updated date

### Example Configuration

\`\`\`json
{
  "documentId": "doc_12345678-1234-1234-1234-123456789012",
  "displayFormat": "formatted",
  "showMetadata": true
}
\`\`\`

## Features

### Display Formats

#### Formatted View
- **Syntax highlighting** for JSON schema elements
- **Collapsible sections** for nested objects
- **Type indicators** with color coding
- **Validation rules** displayed inline

#### Raw JSON View
- **Plain text** JSON schema
- **Copy-to-clipboard** functionality
- **Ideal for developers** who need to copy schema content

#### Compact View
- **Condensed display** for large schemas
- **Summary information** without full details
- **Perfect for overviews** in documentation

### Metadata Display

When enabled, shows:
- **Document title** and description
- **Workspace** information
- **Last updated** timestamp
- **Direct link** to edit in the schema editor

### Error Handling

- **Graceful fallbacks** for missing documents
- **Clear error messages** for configuration issues
- **Timeout handling** for slow network connections
- **Retry mechanisms** for temporary failures

## Customization

### Styling

Modify \`public/confluence/styles.css\` to customize appearance:

\`\`\`css
.schema-document-container {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 16px;
  background: #fafbfc;
}

.schema-content {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.4;
}
\`\`\`

### Functionality

Extend \`public/confluence/macro.js\` for additional features:

\`\`\`javascript
// Add custom display formats
function renderCustomFormat(schemaData) {
  // Your custom rendering logic
  return customFormattedHTML;
}

// Add interactive features
function addSchemaInteractivity() {
  // Add click handlers, tooltips, etc.
}
\`\`\`

## Troubleshooting

### Common Issues

#### Document Not Loading
**Symptoms**: Macro shows "Document not found" or loading spinner
**Solutions**:
- Verify the document ID is correct
- Check that the document exists and is accessible
- Ensure Supabase edge functions are deployed
- Verify network connectivity

#### Plugin Not Appearing
**Symptoms**: Cannot find "Schema Document" in macro browser
**Solutions**:
- Confirm the Forge app is properly installed
- Check the manifest configuration
- Verify external fetch permissions are granted
- Review Confluence admin settings

#### Styling Issues
**Symptoms**: Poor formatting or layout problems
**Solutions**:
- Check that \`styles.css\` is properly loaded
- Use more specific CSS selectors (Confluence may override styles)
- Test in different browsers
- Validate CSS syntax

### Debug Mode

Enable debug logging by adding to your macro:

\`\`\`javascript
window.SCHEMA_PLUGIN_DEBUG = true;
\`\`\`

This will output detailed logging to the browser console.

### Network Issues

Check these endpoints directly:
1. \`{APP_BASE_URL}/functions/v1/plugin-config?type=manifest\`
2. \`{APP_BASE_URL}/functions/v1/public-document?id={TEST_DOC_ID}\`

## Security Considerations

### Data Access
- Only **public documents** are accessible via the plugin
- **Private documents** require authentication and won't display
- **Workspace permissions** are respected

### CORS Configuration
- Plugin endpoints include proper **CORS headers**
- **Origin validation** prevents unauthorized access
- **Rate limiting** protects against abuse

### Content Security
- **HTML sanitization** prevents XSS attacks
- **Input validation** on all parameters
- **Safe rendering** of user-generated content

## Analytics and Monitoring

### Usage Tracking
- Document access logs in Supabase analytics
- Plugin usage metrics via Confluence
- Performance monitoring for load times

### Performance Optimization
- **Caching** of document content
- **Lazy loading** for large schemas
- **Optimized payload** sizes

## Best Practices

### Document Management
1. **Use descriptive titles** for better searchability
2. **Keep schemas well-structured** for better display
3. **Update documentation** when schemas change
4. **Archive old versions** to avoid confusion

### Confluence Integration
1. **Group related schemas** in single pages
2. **Use clear headings** above embedded schemas
3. **Add context** around schema embeds
4. **Link to full editor** for modifications

### Team Workflow
1. **Establish naming conventions** for schemas
2. **Define approval processes** for schema changes
3. **Use workspaces** to organize team schemas
4. **Train team members** on macro usage

## Future Enhancements

### Planned Features
- **Interactive schema exploration** within Confluence
- **Diff views** for schema version comparisons
- **Bulk embedding** of multiple schemas
- **Custom templates** for different schema types

### Integration Roadmap
- **Jira integration** for requirements traceability
- **Slack notifications** for schema updates
- **Microsoft Teams** connector
- **GitHub integration** for version control

## Support and Resources

### Getting Help
- Check **Supabase edge function logs** for backend issues
- Use **Confluence developer console** for frontend debugging
- Monitor **network requests** in browser dev tools
- Review **plugin documentation** for configuration

### Community
- Join our **Discord community** for real-time support
- Browse **GitHub discussions** for common solutions
- Follow our **blog** for integration tutorials
- Attend **webinars** for advanced usage patterns`,

  '/docs/api-reference.md': `# API Reference

Complete reference for the JSON Schema Editor API.

## Authentication

All API requests require authentication using an API key:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     https://api.example.com/v1/schemas
\`\`\`

### Getting an API Key
1. Go to Settings > API Keys
2. Click "Generate New Key"
3. Copy and store securely
4. Set appropriate permissions

## Endpoints

### Schemas

#### List Schemas
\`\`\`http
GET /v1/schemas
\`\`\`

Query Parameters:
- \`workspace_id\` (optional): Filter by workspace
- \`limit\` (optional): Number of results (default: 50)
- \`offset\` (optional): Pagination offset

Response:
\`\`\`json
{
  "schemas": [
    {
      "id": "schema_123",
      "title": "User Schema",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ],
  "total": 1,
  "has_more": false
}
\`\`\`

#### Get Schema
\`\`\`http
GET /v1/schemas/{schema_id}
\`\`\`

Response:
\`\`\`json
{
  "id": "schema_123",
  "title": "User Schema",
  "content": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    }
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-02T00:00:00Z"
}
\`\`\`

#### Create Schema
\`\`\`http
POST /v1/schemas
\`\`\`

Request Body:
\`\`\`json
{
  "title": "New Schema",
  "workspace_id": "workspace_456",
  "content": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    }
  }
}
\`\`\`

#### Update Schema
\`\`\`http
PUT /v1/schemas/{schema_id}
\`\`\`

Request Body:
\`\`\`json
{
  "title": "Updated Schema",
  "content": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" }
    }
  }
}
\`\`\`

#### Delete Schema
\`\`\`http
DELETE /v1/schemas/{schema_id}
\`\`\`

### Workspaces

#### List Workspaces
\`\`\`http
GET /v1/workspaces
\`\`\`

#### Get Workspace
\`\`\`http
GET /v1/workspaces/{workspace_id}
\`\`\`

#### Create Workspace
\`\`\`http
POST /v1/workspaces
\`\`\`

### Validation

#### Validate Schema
\`\`\`http
POST /v1/validate/schema
\`\`\`

Request Body:
\`\`\`json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    }
  }
}
\`\`\`

Response:
\`\`\`json
{
  "valid": true,
  "errors": []
}
\`\`\`

#### Validate Data Against Schema
\`\`\`http
POST /v1/validate/data
\`\`\`

Request Body:
\`\`\`json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  },
  "data": {
    "name": "John Doe"
  }
}
\`\`\`

## Error Handling

### Error Response Format
\`\`\`json
{
  "error": {
    "type": "validation_error",
    "message": "Schema validation failed",
    "details": {
      "field": "properties.name.type",
      "issue": "Invalid type specification"
    }
  }
}
\`\`\`

### Common Error Codes
- \`400\`: Bad Request - Invalid input
- \`401\`: Unauthorized - Invalid API key
- \`403\`: Forbidden - Insufficient permissions
- \`404\`: Not Found - Resource doesn't exist
- \`429\`: Rate Limited - Too many requests
- \`500\`: Internal Error - Server issue

## Rate Limits

- **Free Plan**: 100 requests/hour
- **Pro Plan**: 1,000 requests/hour
- **Enterprise**: 10,000 requests/hour

Rate limit headers:
- \`X-RateLimit-Limit\`: Total limit
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Reset timestamp

## SDKs and Libraries

### JavaScript/Node.js
\`\`\`bash
npm install @schema-editor/sdk
\`\`\`

\`\`\`javascript
import { SchemaEditor } from '@schema-editor/sdk';

const client = new SchemaEditor('YOUR_API_KEY');
const schemas = await client.schemas.list();
\`\`\`

### Python
\`\`\`bash
pip install schema-editor-python
\`\`\`

\`\`\`python
from schema_editor import SchemaEditor

client = SchemaEditor('YOUR_API_KEY')
schemas = client.schemas.list()
\`\`\`
`
};

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  docPath,
  title,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // In a real app, you would fetch from actual files
        // For now, we'll use the sample content
        const docContent = sampleDocs[docPath];
        
        if (docContent) {
          setContent(docContent);
        } else {
          setError(`Documentation not found: ${docPath}`);
        }
      } catch (err) {
        setError(`Failed to load documentation: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [docPath]);

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <div className="space-y-2 mt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </div>
      
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 max-w-4xl">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-foreground mb-3 mt-6">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-foreground mb-4 leading-relaxed">
                    {children}
                  </p>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={`${className} block bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono`}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto mb-4">
                    {children}
                  </pre>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-4 text-foreground space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-4 text-foreground space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-foreground leading-relaxed">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-primary hover:text-primary/80 underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};