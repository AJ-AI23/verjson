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
        Relationships: []
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
        ]
      }
      documents: {
        Row: {
          content: Json
          created_at: string
          crowdin_file_id: string | null
          crowdin_filename: string | null
          crowdin_project_id: string | null
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
          crowdin_filename?: string | null
          crowdin_project_id?: string | null
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
          crowdin_filename?: string | null
          crowdin_project_id?: string | null
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
        ]
      }
      editor_history: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          document_id: string
          id: string
          sequence_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          document_id: string
          id?: string
          sequence_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          document_id?: string
          id?: string
          sequence_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          document_id: string
          id: string
          invitation_data: Json | null
          invitation_type: string | null
          message: string
          read_at: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          invitation_data?: Json | null
          invitation_type?: string | null
          message: string
          read_at?: string | null
          status?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          invitation_data?: Json | null
          invitation_type?: string | null
          message?: string
          read_at?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { notification_id: string }
        Returns: boolean
      }
      cleanup_old_editor_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_invitation_notification: {
        Args: {
          inv_data: Json
          inv_type: string
          inviter_user_id: string
          message: string
          target_user_id: string
          title: string
        }
        Returns: string
      }
      decline_invitation: {
        Args: { notification_id: string }
        Returns: boolean
      }
      generate_content_hash: {
        Args: { content: string }
        Returns: string
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
