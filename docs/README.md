# Documentation

This directory contains the documentation for the JSON Schema Editor application.

## Structure

- `getting-started.md` - Introduction and quick start guide
- `schema-editor.md` - Detailed editor features and usage
- `diagram-view.md` - Visualization capabilities
- `collaboration.md` - Team features and sharing
- `api-reference.md` - Complete API documentation

## Adding New Documentation

1. Create a new `.md` file in this directory
2. Add the entry to `DocumentationDialog.tsx` in the `documentationItems` array
3. Include the content in the `sampleDocs` object in `DocumentationViewer.tsx`

## Future Enhancements

- Automatic markdown file discovery
- Git-based content management
- Version control for documentation
- Search indexing and full-text search