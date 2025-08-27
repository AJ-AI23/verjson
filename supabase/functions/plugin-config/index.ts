import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const configType = url.searchParams.get('type') || 'manifest';

    // Base URL for your application
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://your-app-domain.com';

    if (configType === 'manifest') {
      // Return Forge app manifest configuration
      const manifest = {
        modules: {
          'confluence:contentBylineItem': [
            {
              key: 'document-viewer-byline',
              resource: 'document-viewer',
              resolver: {
                function: 'resolver'
              },
              title: {
                value: 'Schema Document'
              }
            }
          ],
          'confluence:macro': [
            {
              key: 'schema-document-macro',
              function: 'main',
              title: {
                value: 'Schema Document'
              },
              description: {
                value: 'Display a schema document from your application'
              },
              parameters: [
                {
                  identifier: 'documentId',
                  type: 'string',
                  displayName: 'Document ID',
                  description: 'The ID of the document to display',
                  required: true
                },
                {
                  identifier: 'format',
                  type: 'enum',
                  displayName: 'Display Format',
                  description: 'How to display the document',
                  defaultValue: 'formatted',
                  values: [
                    { label: 'Formatted View', value: 'formatted' },
                    { label: 'Raw JSON', value: 'raw' },
                    { label: 'Compact', value: 'compact' }
                  ]
                },
                {
                  identifier: 'showMetadata',
                  type: 'boolean',
                  displayName: 'Show Metadata',
                  description: 'Include document metadata',
                  defaultValue: true
                }
              ]
            }
          ]
        },
        resources: [
          {
            key: 'main',
            path: `${baseUrl}/confluence/macro.js`
          },
          {
            key: 'resolver',
            path: `${baseUrl}/confluence/resolver.js`
          },
          {
            key: 'document-viewer',
            path: `${baseUrl}/confluence/viewer.js`
          }
        ],
        permissions: {
          scopes: [
            'read:confluence-content.summary'
          ],
          external: {
            fetch: {
              backend: [`${baseUrl}/functions/*`]
            }
          }
        }
      };

      return new Response(
        JSON.stringify(manifest, null, 2),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json'
          } 
        }
      );
    }

    if (configType === 'endpoints') {
      // Return available API endpoints for the plugin
      const endpoints = {
        publicDocument: `${baseUrl}/functions/v1/public-document`,
        pluginConfig: `${baseUrl}/functions/v1/plugin-config`,
        analytics: `${baseUrl}/functions/v1/plugin-analytics`
      };

      return new Response(
        JSON.stringify(endpoints, null, 2),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json'
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid config type' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});