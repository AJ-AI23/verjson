import api, { route } from "@forge/api";
import ForgeUI, { render, Fragment, Text, Code, Strong, Em, Link, Table, Row, Cell, Head, useState, useEffect } from "@forge/ui";

const App = () => {
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get macro parameters
  const context = useProductContext();
  const { documentId, format = 'formatted', showMetadata = true } = context?.extension?.config || {};

  useEffect(async () => {
    if (!documentId) {
      setError('Document ID is required');
      setLoading(false);
      return;
    }

    try {
      // Fetch document from your Supabase edge function
      const baseUrl = 'https://swghcmyqracwifpdfyap.supabase.co/functions/v1';
      const params = new URLSearchParams({
        id: documentId,
        format: 'confluence',
        metadata: showMetadata.toString()
      });
      
      const response = await api.fetch(`${baseUrl}/public-document?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
      }
      
      const data = await response.json();
      setDocumentData(data);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  if (loading) {
    return (
      <Fragment>
        <Text>Loading schema document...</Text>
      </Fragment>
    );
  }

  if (error) {
    return (
      <Fragment>
        <Text><Strong>Error:</Strong> {error}</Text>
      </Fragment>
    );
  }

  if (!documentData) {
    return (
      <Fragment>
        <Text>No document data available</Text>
      </Fragment>
    );
  }

  const renderMetadata = () => {
    if (!showMetadata || !documentData.metadata) return null;
    
    const { metadata } = documentData;
    return (
      <Fragment>
        <Text><Strong>Document Information</Strong></Text>
        <Table>
          <Head>
            <Cell><Text>Property</Text></Cell>
            <Cell><Text>Value</Text></Cell>
          </Head>
          {metadata.name && (
            <Row>
              <Cell><Text>Name</Text></Cell>
              <Cell><Text>{metadata.name}</Text></Cell>
            </Row>
          )}
          {metadata.workspace && (
            <Row>
              <Cell><Text>Workspace</Text></Cell>
              <Cell><Text>{metadata.workspace}</Text></Cell>
            </Row>
          )}
          {metadata.updated_at && (
            <Row>
              <Cell><Text>Last Updated</Text></Cell>
              <Cell><Text>{new Date(metadata.updated_at).toLocaleDateString()}</Text></Cell>
            </Row>
          )}
        </Table>
      </Fragment>
    );
  };

  const renderContent = () => {
    if (format === 'raw') {
      return (
        <Code text={JSON.stringify(documentData.content, null, 2)} />
      );
    }

    if (format === 'compact') {
      return (
        <Code text={JSON.stringify(documentData.content)} />
      );
    }

    // Formatted view
    if (documentData.formatted_content) {
      return (
        <Fragment>
          <Text>{documentData.formatted_content}</Text>
        </Fragment>
      );
    }

    // Fallback to code block
    return (
      <Code text={JSON.stringify(documentData.content, null, 2)} />
    );
  };

  return (
    <Fragment>
      {renderMetadata()}
      {renderContent()}
      <Text>
        <Em>
          <Link href={`https://your-app-domain.com/document/${documentId}`}>
            View in Schema Editor →
          </Link>
        </Em>
      </Text>
    </Fragment>
  );
};

export const run = render(<App />);