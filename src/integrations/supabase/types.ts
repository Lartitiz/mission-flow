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
      actions: {
        Row: {
          assignee: string
          budget_ht: number | null
          category: string | null
          channel: string | null
          client_comment: string | null
          created_at: string
          description: string | null
          hours_estimated: number | null
          id: string
          mission_id: string
          phase: string | null
          sort_order: number
          status: string
          target_date: string | null
          task: string
          updated_at: string
        }
        Insert: {
          assignee: string
          budget_ht?: number | null
          category?: string | null
          channel?: string | null
          client_comment?: string | null
          created_at?: string
          description?: string | null
          hours_estimated?: number | null
          id?: string
          mission_id: string
          phase?: string | null
          sort_order?: number
          status?: string
          target_date?: string | null
          task: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          budget_ht?: number | null
          category?: string | null
          channel?: string | null
          client_comment?: string | null
          created_at?: string
          description?: string | null
          hours_estimated?: number | null
          id?: string
          mission_id?: string
          phase?: string | null
          sort_order?: number
          status?: string
          target_date?: string | null
          task?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      claude_projects: {
        Row: {
          completed_prompts: Json
          created_at: string
          id: string
          mission_id: string
          prompt_chain: Json
          prompt_system: string
          updated_at: string
          version: number
          warnings: Json
        }
        Insert: {
          completed_prompts?: Json
          created_at?: string
          id?: string
          mission_id: string
          prompt_chain?: Json
          prompt_system: string
          updated_at?: string
          version?: number
          warnings?: Json
        }
        Update: {
          completed_prompts?: Json
          created_at?: string
          id?: string
          mission_id?: string
          prompt_chain?: Json
          prompt_system?: string
          updated_at?: string
          version?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "claude_projects_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_calls: {
        Row: {
          ai_suggested_type: string | null
          created_at: string
          id: string
          mission_id: string
          questions_asked: Json | null
          raw_notes: string | null
          structured_notes: Json | null
          updated_at: string
        }
        Insert: {
          ai_suggested_type?: string | null
          created_at?: string
          id?: string
          mission_id: string
          questions_asked?: Json | null
          raw_notes?: string | null
          structured_notes?: Json | null
          updated_at?: string
        }
        Update: {
          ai_suggested_type?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          questions_asked?: Json | null
          raw_notes?: string | null
          structured_notes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mission_id: string
          storage_path: string
          uploaded_by: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mission_id: string
          storage_path: string
          uploaded_by?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mission_id?: string
          storage_path?: string
          uploaded_by?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          mission_id: string
          source: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mission_id: string
          source?: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mission_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      kickoffs: {
        Row: {
          ai_questions: Json | null
          completed_at: string | null
          created_at: string
          declic_questions_enabled: boolean
          fixed_questions: Json | null
          id: string
          mission_id: string
          mode: string
          questionnaire_responses: Json | null
          questionnaire_status: string
          questionnaire_token: string
          raw_notes: string | null
          sent_at: string | null
          structured_notes: Json | null
          updated_at: string
        }
        Insert: {
          ai_questions?: Json | null
          completed_at?: string | null
          created_at?: string
          declic_questions_enabled?: boolean
          fixed_questions?: Json | null
          id?: string
          mission_id: string
          mode?: string
          questionnaire_responses?: Json | null
          questionnaire_status?: string
          questionnaire_token?: string
          raw_notes?: string | null
          sent_at?: string | null
          structured_notes?: Json | null
          updated_at?: string
        }
        Update: {
          ai_questions?: Json | null
          completed_at?: string | null
          created_at?: string
          declic_questions_enabled?: boolean
          fixed_questions?: Json | null
          id?: string
          mission_id?: string
          mode?: string
          questionnaire_responses?: Json | null
          questionnaire_status?: string
          questionnaire_token?: string
          raw_notes?: string | null
          sent_at?: string | null
          structured_notes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kickoffs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          amount: number | null
          client_email: string | null
          client_link_active: boolean
          client_name: string
          client_slug: string
          client_token: string
          created_at: string
          id: string
          mission_type: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_email?: string | null
          client_link_active?: boolean
          client_name: string
          client_slug: string
          client_token?: string
          created_at?: string
          id?: string
          mission_type?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_email?: string | null
          client_link_active?: boolean
          client_name?: string
          client_slug?: string
          client_token?: string
          created_at?: string
          id?: string
          mission_type?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pitch_scripts: {
        Row: {
          content: string
          id: string
          script_type: string
          sort_order: number
          title: string
        }
        Insert: {
          content: string
          id?: string
          script_type: string
          sort_order?: number
          title: string
        }
        Update: {
          content?: string
          id?: string
          script_type?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          clarification_qa: Json | null
          content: Json | null
          created_at: string
          email_draft: string | null
          id: string
          mission_id: string
          status: string
          tutoiement: boolean
          updated_at: string
          version: number
        }
        Insert: {
          clarification_qa?: Json | null
          content?: Json | null
          created_at?: string
          email_draft?: string | null
          id?: string
          mission_id: string
          status?: string
          tutoiement?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          clarification_qa?: Json | null
          content?: Json | null
          created_at?: string
          email_draft?: string | null
          id?: string
          mission_id?: string
          status?: string
          tutoiement?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          next_session_agenda: string | null
          next_session_date: string | null
          raw_notes: string | null
          session_date: string
          session_type: string
          structured_notes: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          next_session_agenda?: string | null
          next_session_date?: string | null
          raw_notes?: string | null
          session_date: string
          session_type?: string
          structured_notes?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          next_session_agenda?: string | null
          next_session_date?: string | null
          raw_notes?: string | null
          session_date?: string
          session_type?: string
          structured_notes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_client_slug: { Args: { p_client_name: string }; Returns: string }
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
