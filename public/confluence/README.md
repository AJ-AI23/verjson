# Schema Document Confluence Plugin

This Atlassian Forge plugin allows you to embed schema documents from your application directly into Confluence pages.

## Installation

### Method 1: Using Forge CLI (Recommended for Development)

1. Install the Forge CLI:
   ```bash
   npm install -g @forge/cli
   ```

2. Create a new Forge app:
   ```bash
   forge create --template custom-ui
   ```

3. Replace the generated files with the files from this directory

4. Deploy and install:
   ```bash
   forge deploy
   forge install
   ```

### Method 2: Self-Hosted Installation

1. Host the plugin files on your domain (they're already in your public folder)
2. Create a Forge app manifest that points to your hosted files
3. Use the `/functions/v1/plugin-config` endpoint to serve dynamic configuration

## Configuration

The plugin requires these environment variables in your Supabase edge functions:

- `APP_BASE_URL`: Your application's base URL
- `SUPABASE_URL`: Your Supabase project URL  
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

## Usage

1. In Confluence, add a macro to your page
2. Search for "Schema Document" 
3. Configure the macro with:
   - **Document ID**: The ID of your schema document
   - **Display Format**: How to show the document (formatted, raw JSON, or compact)
   - **Show Metadata**: Whether to include document metadata

## API Endpoints

The plugin uses these endpoints:

- `GET /functions/v1/public-document?id={documentId}&format=confluence&metadata=true`
- `GET /functions/v1/plugin-config?type=manifest`
- `GET /functions/v1/plugin-config?type=endpoints`

## Features

- **Multiple Display Formats**: Choose between formatted view, raw JSON, or compact display
- **Metadata Display**: Show document name, workspace, and last updated date
- **Error Handling**: Graceful handling of missing or inaccessible documents
- **Direct Links**: Links back to your application for editing
- **Analytics**: Track plugin usage through document access logs

## Customization

You can customize the plugin by:

1. Modifying `styles.css` for visual appearance
2. Updating `macro.js` for functionality changes
3. Extending the `public-document` edge function for additional data
4. Adding new display formats or parameters

## Troubleshooting

**Document not loading?**
- Ensure the document ID is correct
- Check that the document exists and is accessible
- Verify your Supabase edge functions are deployed

**Plugin not appearing in Confluence?**
- Confirm the Forge app is properly installed
- Check the manifest configuration
- Verify external fetch permissions are granted

**Styling issues?**
- Check that `styles.css` is properly loaded
- Confluence may override some CSS - use specific selectors

## Development

To modify the plugin:

1. Edit the files in this directory
2. If using Forge CLI: `forge deploy` to update
3. If self-hosted: Changes are live immediately

## Support

For issues or questions about the plugin, check:
1. Your Supabase edge function logs
2. Confluence developer console
3. Network requests in browser dev tools