export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  content: any;
  file_type: 'json-schema' | 'openapi';
  pin_code?: string;
  pin_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
}

export interface CreateDocumentData {
  workspace_id: string;
  name: string;
  content: any;
  file_type: 'json-schema' | 'openapi';
}