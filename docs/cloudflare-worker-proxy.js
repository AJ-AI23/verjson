/**
 * Cloudflare Worker - API Proxy for Verjson
 * 
 * This worker proxies requests from your custom domain to Supabase Edge Functions.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://dash.cloudflare.com/ and log in
 * 2. Navigate to Workers & Pages > Create Application > Create Worker
 * 3. Give it a name (e.g., "verjson-api-proxy")
 * 4. Paste this code and click "Deploy"
 * 5. Go to Settings > Triggers > Add Custom Domain
 * 6. Add your domain (e.g., api.verjson.com or verjson.com/api/v1/*)
 * 
 * ROUTE CONFIGURATION:
 * - Route pattern: yourdomain.com/api/v1/*
 * - Or use a subdomain: api.yourdomain.com/*
 */

const SUPABASE_URL = 'https://swghcmyqracwifpdfyap.supabase.co/functions/v1';

// Headers to forward from the original request
const FORWARD_HEADERS = [
  'x-api-key',
  'authorization',
  'content-type',
  'accept',
  'x-client-info',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Client-Info, apikey',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Extract the path after /api/v1/
    let targetPath = url.pathname;
    
    // Remove /api/v1 prefix if present
    if (targetPath.startsWith('/api/v1')) {
      targetPath = targetPath.replace(/^\/api\/v1/, '');
    }
    
    // If path is empty, default to root
    if (!targetPath || targetPath === '/') {
      targetPath = '';
    }

    // Build the target URL
    const targetUrl = `${SUPABASE_URL}${targetPath}${url.search}`;

    // Build headers for the proxied request
    const headers = new Headers();
    
    // Forward specific headers from the original request
    for (const headerName of FORWARD_HEADERS) {
      const value = request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }

    // Add the Supabase anon key as apikey header (required for Supabase)
    headers.set('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3Z2hjbXlxcmFjd2lmcGRmeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxOTkyNzMsImV4cCI6MjA3MTc3NTI3M30.El9QwmA4aMu1-S-NMvgm5gmFYcZNZicB3-0BXFc-bV8');

    // Prepare the fetch options
    const fetchOptions = {
      method: request.method,
      headers: headers,
    };

    // Include body for non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text();
    }

    try {
      // Make the request to Supabase
      const response = await fetch(targetUrl, fetchOptions);

      // Clone the response and add CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Client-Info, apikey');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Proxy error', 
        message: error.message 
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
