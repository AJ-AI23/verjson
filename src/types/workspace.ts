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

export interface Document {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  content: any;
  file_type: 'json-schema' | 'openapi';
  pin_code?: string;
  pin_enabled: boolean;
  crowdin_file_id?: string;
  crowdin_file_ids?: string[];
  crowdin_project_id?: string;
  crowdin_filename?: string;
  crowdin_filenames?: string[];
  crowdin_split_by_paths?: boolean;
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