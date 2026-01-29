# VerjSON

A visual schema editor and documentation platform for API specifications, JSON Schema, sequence diagrams, and markdown documents.

## Overview

VerjSON provides a unified workspace for creating, editing, and managing structured documents with real-time collaboration, version control, and visual diagram generation.

## Features

### Document Types

- **OpenAPI Specifications** — Create and edit OpenAPI 3.x documents with a visual structure editor
- **JSON Schema** — Design and validate JSON Schema definitions with property management
- **Sequence Diagrams** — Build interactive sequence diagrams with lifelines, nodes, and processes
- **Markdown Documents** — Author rich markdown content with embedded diagrams and styling

### Visual Editing

- **Structure Editor** — Navigate and edit document structure through an intuitive tree view
- **Schema Diagrams** — Automatically generate visual diagrams from your schema definitions
- **Dual-Pane Interface** — Side-by-side JSON editor and visual preview with bidirectional sync
- **Drag-and-Drop** — Reorder properties, array items, and components with drag-and-drop

### Version Control

- **Version History** — Track all changes with semantic versioning (major.minor.patch)
- **Version Comparison** — Compare any two versions with diff visualization
- **Released Versions** — Mark stable versions as released for reference
- **Import/Export** — Import versions from other documents or external sources

### Collaboration

- **Workspaces** — Organize documents into collaborative workspaces
- **Real-time Sync** — Multiple users can edit simultaneously with live updates
- **Permissions** — Role-based access control (owner, editor, viewer)
- **Notifications** — Stay informed about document changes and invitations

### Advanced Features

- **Consistency Checking** — Detect and resolve inconsistencies across your schemas
- **Component References** — Reuse schema components with `$ref` references
- **Document References** — Link schemas across documents for modular design
- **Crowdin Integration** — Export and sync translations for internationalization
- **PDF/Image Export** — Render diagrams and documents to downloadable formats
- **Public Sharing** — Generate public links for read-only document access

## Technology Stack

- **Frontend** — React, TypeScript, Vite, Tailwind CSS
- **UI Components** — shadcn/ui, Radix UI primitives
- **Diagrams** — React Flow for interactive node-based diagrams
- **Editor** — Monaco Editor for JSON/code editing
- **Backend** — Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Real-time** — Yjs for conflict-free collaborative editing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```sh
# Clone the repository
git clone <repository-url>
cd verjson

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anonymous key

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [VerjSON Configuration](docs/verjson-configuration.md)
- [API Documentation](/api-docs)

## License

Copyright © 2024. All rights reserved.
