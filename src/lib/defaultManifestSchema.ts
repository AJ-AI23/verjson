import { ManifestDocument, defaultManifestTheme } from '@/types/manifest';

/**
 * Default manifest document template for new manifest documents.
 */
export const defaultManifestSchema: ManifestDocument = {
  verjson: '1.0.0',
  type: 'manifest',
  info: {
    version: '0.1.0',
    title: 'New Documentation',
    description: 'A new documentation manifest',
    author: '',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  },
  data: {
    toc: [
      {
        id: 'getting-started',
        title: 'Getting Started',
        icon: 'BookOpen',
        description: 'Introduction and quick start guide',
        children: [
          {
            id: 'introduction',
            title: 'Introduction',
            description: 'Overview of the documentation',
            keywords: ['intro', 'overview', 'start'],
          },
          {
            id: 'installation',
            title: 'Installation',
            description: 'How to install and set up',
            keywords: ['install', 'setup', 'configure'],
          },
        ],
      },
      {
        id: 'guides',
        title: 'Guides',
        icon: 'FileText',
        description: 'In-depth guides and tutorials',
        children: [],
      },
      {
        id: 'reference',
        title: 'Reference',
        icon: 'Library',
        description: 'API and configuration reference',
        children: [],
      },
    ],
    index: [
      {
        keyword: 'getting started',
        entries: [
          { tocId: 'getting-started', context: 'Introduction and quick start guide' },
        ],
      },
      {
        keyword: 'installation',
        entries: [
          { tocId: 'installation', context: 'How to install and set up' },
        ],
      },
    ],
    embeds: [],
    defaultPage: 'introduction',
  },
  styles: {
    themes: {
      default: defaultManifestTheme,
    },
  },
  selectedTheme: 'default',
};
