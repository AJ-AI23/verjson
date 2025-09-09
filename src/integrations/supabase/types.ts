export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      collaboration_sessions: {
        Row: {
          created_at: string
          cursor_position: Json | null
          document_id: string
          id: string
          last_seen: string
          user_avatar: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          cursor_position?: Json | null
          document_id: string
          id?: string
          last_seen?: string
          user_avatar?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          cursor_position?: Json | null
          document_id?: string
          id?: string
          last_seen?: string
          user_avatar?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_collaboration_sessions_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_collaboration_sessions_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          access_type: string
          created_at: string
          document_id: string
          id: string
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          access_type?: string
          created_at?: string
          document_id: string
          id?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string
          document_id?: string
          id?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_document_access_logs_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_permissions: {
        Row: {
          created_at: string
          document_id: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["permission_role"]
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          granted_by: string
          id?: string
          role?: Database["public"]["Enums"]["permission_role"]
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          granted_by?: string
          id?: string
          role?: Database["public"]["Enums"]["permission_role"]
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_document_permissions_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_document_permissions_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          description: string
          document_id: string
          full_document: Json | null
          id: string
          is_released: boolean
          is_selected: boolean
          patches: Json | null
          tier: string
          updated_at: string
          user_id: string
          version_major: number
          version_minor: number
          version_patch: number
        }
        Insert: {
          created_at?: string
          description: string
          document_id: string
          full_document?: Json | null
          id?: string
          is_released?: boolean
          is_selected?: boolean
          patches?: Json | null
          tier: string
          updated_at?: string
          user_id: string
          version_major?: number
          version_minor?: number
          version_patch?: number
        }
        Update: {
          created_at?: string
          description?: string
          document_id?: string
          full_document?: Json | null
          id?: string
          is_released?: boolean
          is_selected?: boolean
          patches?: Json | null
          tier?: string
          updated_at?: string
          user_id?: string
          version_major?: number
          version_minor?: number
          version_patch?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_document_versions_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_document_versions_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json
          created_at: string
          crowdin_file_id: string | null
          crowdin_file_ids: Json | null
          crowdin_filename: string | null
          crowdin_filenames: Json | null
          crowdin_project_id: string | null
          crowdin_split_by_paths: boolean | null
          file_type: string
          id: string
          name: string
          pin_code: string | null
          pin_enabled: boolean
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          crowdin_file_id?: string | null
          crowdin_file_ids?: Json | null
          crowdin_filename?: string | null
          crowdin_filenames?: Json | null
          crowdin_project_id?: string | null
          crowdin_split_by_paths?: boolean | null
          file_type?: string
          id?: string
          name: string
          pin_code?: string | null
          pin_enabled?: boolean
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          crowdin_file_id?: string | null
          crowdin_file_ids?: Json | null
          crowdin_filename?: string | null
          crowdin_filenames?: Json | null
          crowdin_project_id?: string | null
          crowdin_split_by_paths?: boolean | null
          file_type?: string
          id?: string
          name?: string
          pin_code?: string | null
          pin_enabled?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_documents_workspace_id"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          message: string
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          message: string
          read_at?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_notifications_workspace_id"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      workspace_crowdin_settings: {
        Row: {
          created_at: string
          created_by: string
          encrypted_api_token: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          encrypted_api_token: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          encrypted_api_token?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace_crowdin_settings_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_workspace_crowdin_settings_workspace_id"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_permissions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["permission_role"]
          status: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          role?: Database["public"]["Enums"]["permission_role"]
          status?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          role?: Database["public"]["Enums"]["permission_role"]
          status?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace_permissions_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_workspace_permissions_workspace_id"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspaces_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      yjs_documents: {
        Row: {
          created_at: string
          document_id: string
          id: string
          updated_at: string
          user_id: string
          yjs_state: string
          yjs_vector_clock: Json
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          updated_at?: string
          user_id: string
          yjs_state: string
          yjs_vector_clock?: Json
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          yjs_state?: string
          yjs_vector_clock?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_yjs_documents_document_id"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_yjs_documents_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { invitation_id: string; invitation_type: string }
        Returns: {
          document_id: string
          message: string
          success: boolean
          workspace_id: string
        }[]
      }
      cleanup_old_collaboration_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_editor_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_initial_version_safe: {
        Args: { p_content: Json; p_document_id: string; p_user_id: string }
        Returns: string
      }
      create_workspace_notification: {
        Args: {
          exclude_user_id?: string
          notification_message: string
          notification_title: string
          notification_type: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      decline_invitation: {
        Args: { invitation_id: string; invitation_type: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      generate_content_hash: {
        Args: { content: string }
        Returns: string
      }
      get_document_permissions: {
        Args: { doc_id: string }
        Returns: {
          created_at: string
          document_id: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["permission_role"]
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          username: string
        }[]
      }
      get_user_all_permissions: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          granted_by: string
          id: string
          resource_id: string
          resource_name: string
          role: Database["public"]["Enums"]["permission_role"]
          status: string
          type: string
          updated_at: string
          workspace_name: string
        }[]
      }
      get_user_invitations: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          document_id: string
          document_name: string
          id: string
          inviter_email: string
          inviter_name: string
          role: Database["public"]["Enums"]["permission_role"]
          type: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      get_workspace_permissions: {
        Args: { ws_id: string }
        Returns: {
          created_at: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["permission_role"]
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          username: string
          workspace_id: string
        }[]
      }
      user_has_workspace_access: {
        Args: { user_id: string; workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      permission_role: "owner" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      permission_role: ["owner", "editor", "viewer"],
    },
  },
} as const
