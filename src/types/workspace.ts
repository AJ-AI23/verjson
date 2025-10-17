export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  isOwner?: boolean;
  role?: string;
  collaboratorCount?: number;
}

export interface CrowdinIntegration {
  id: string;
  document_id: string;
  project_id?: string;
  file_id?: string;
  file_ids?: string[];
  filename?: string;
  filenames?: string[];
  split_by_paths?: boolean;
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
  crowdin_integration_id?: string;
  crowdin_integration?: CrowdinIntegration;
  created_at: string;
  updated_at: string;
  import_url?: string;
  // Properties for shared documents
  workspace_name?: string;
  shared_role?: 'editor' | 'viewer';
  is_shared?: boolean;
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
  import_url?: string;
}