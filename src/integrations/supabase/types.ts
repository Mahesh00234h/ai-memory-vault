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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      captured_contexts: {
        Row: {
          captured_at: string
          decisions: Json | null
          id: string
          key_points: Json | null
          legacy_user_id: string | null
          message_count: number | null
          open_questions: Json | null
          platform: string | null
          raw_content: string | null
          summary: string | null
          team_id: string | null
          tech_stack: Json | null
          title: string
          topic: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          legacy_user_id?: string | null
          message_count?: number | null
          open_questions?: Json | null
          platform?: string | null
          raw_content?: string | null
          summary?: string | null
          team_id?: string | null
          tech_stack?: Json | null
          title: string
          topic?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          captured_at?: string
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          legacy_user_id?: string | null
          message_count?: number | null
          open_questions?: Json | null
          platform?: string | null
          raw_content?: string | null
          summary?: string | null
          team_id?: string | null
          tech_stack?: Json | null
          title?: string
          topic?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captured_contexts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captured_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "extension_users"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_users: {
        Row: {
          created_at: string
          id: string
          migrated_to_auth_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          migrated_to_auth_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          migrated_to_auth_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          captured_by_name: string | null
          content_hash: string | null
          created_at: string
          decisions: Json | null
          id: string
          key_points: Json | null
          memory_version: number
          message_count: number | null
          open_questions: Json | null
          project_id: string | null
          raw_text: string | null
          source_captured_at: string | null
          source_page_title: string | null
          source_platform: string | null
          source_thread_key: string | null
          source_url: string | null
          summary: string | null
          team_id: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          captured_by_name?: string | null
          content_hash?: string | null
          created_at?: string
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          memory_version?: number
          message_count?: number | null
          open_questions?: Json | null
          project_id?: string | null
          raw_text?: string | null
          source_captured_at?: string | null
          source_page_title?: string | null
          source_platform?: string | null
          source_thread_key?: string | null
          source_url?: string | null
          summary?: string | null
          team_id?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          captured_by_name?: string | null
          content_hash?: string | null
          created_at?: string
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          memory_version?: number
          message_count?: number | null
          open_questions?: Json | null
          project_id?: string | null
          raw_text?: string | null
          source_captured_at?: string | null
          source_page_title?: string | null
          source_platform?: string | null
          source_thread_key?: string | null
          source_url?: string | null
          summary?: string | null
          team_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "extension_users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_summaries: {
        Row: {
          context_ids: Json | null
          created_at: string
          created_by: string | null
          decisions: Json | null
          id: string
          key_points: Json | null
          last_merge_at: string | null
          member_attributions: Json | null
          memory_ids: Json | null
          merge_version: number | null
          open_questions: Json | null
          summary: string
          team_id: string
          tech_stack: Json | null
          title: string
          topic_cluster: string | null
          updated_at: string
        }
        Insert: {
          context_ids?: Json | null
          created_at?: string
          created_by?: string | null
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          last_merge_at?: string | null
          member_attributions?: Json | null
          memory_ids?: Json | null
          merge_version?: number | null
          open_questions?: Json | null
          summary: string
          team_id: string
          tech_stack?: Json | null
          title: string
          topic_cluster?: string | null
          updated_at?: string
        }
        Update: {
          context_ids?: Json | null
          created_at?: string
          created_by?: string | null
          decisions?: Json | null
          id?: string
          key_points?: Json | null
          last_merge_at?: string | null
          member_attributions?: Json | null
          memory_ids?: Json | null
          merge_version?: number | null
          open_questions?: Json | null
          summary?: string
          team_id?: string
          tech_stack?: Json | null
          title?: string
          topic_cluster?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "extension_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_summaries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "extension_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team_member: {
        Args: { check_team_id: string; check_user_id: string }
        Returns: boolean
      }
      is_team_member_via_memories: {
        Args: { check_team_id: string; check_user_id: string }
        Returns: boolean
      }
      user_exists: { Args: { check_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
