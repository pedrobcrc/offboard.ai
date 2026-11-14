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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          document_id: string
          id: number
          search: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          document_id: string
          id?: never
          search: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          document_id?: string
          id?: never
          search?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string
          created_at: string
          detail: string
          filename: string
          id: string
          kind: string
          offboarding_id: string
          size_label: string
        }
        Insert: {
          content: string
          created_at?: string
          detail: string
          filename: string
          id?: string
          kind: string
          offboarding_id?: string
          size_label: string
        }
        Update: {
          content?: string
          created_at?: string
          detail?: string
          filename?: string
          id?: string
          kind?: string
          offboarding_id?: string
          size_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_offboarding_id_fkey"
            columns: ["offboarding_id"]
            isOneToOne: false
            referencedRelation: "offboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      offboardings: {
        Row: {
          created_at: string
          departing_member_id: string | null
          departing_name: string
          departing_role: string
          id: string
          is_sample: boolean
          last_working_day: string
          status: string
        }
        Insert: {
          created_at?: string
          departing_member_id?: string | null
          departing_name: string
          departing_role: string
          id?: string
          is_sample?: boolean
          last_working_day: string
          status?: string
        }
        Update: {
          created_at?: string
          departing_member_id?: string | null
          departing_name?: string
          departing_role?: string
          id?: string
          is_sample?: boolean
          last_working_day?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboardings_departing_member_id_fkey"
            columns: ["departing_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decisions: {
        Row: {
          action: string
          ai_proposal: string
          created_at: string
          final_decision: string
          id: string
          offboarding_id: string
          proposal_id: string
          reason: string
          task_id: string
          task_title: string
        }
        Insert: {
          action: string
          ai_proposal: string
          created_at?: string
          final_decision: string
          id?: string
          offboarding_id?: string
          proposal_id: string
          reason: string
          task_id: string
          task_title: string
        }
        Update: {
          action?: string
          ai_proposal?: string
          created_at?: string
          final_decision?: string
          id?: string
          offboarding_id?: string
          proposal_id?: string
          reason?: string
          task_id?: string
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decisions_offboarding_id_fkey"
            columns: ["offboarding_id"]
            isOneToOne: false
            referencedRelation: "offboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_proposed_buyer: string | null
          assigned_at: string | null
          assigned_buyer: string | null
          assigned_initials: string | null
          assigned_member_id: string | null
          assigned_tone: string | null
          confidence: string | null
          criticality: string
          due_date: string | null
          id: string
          offboarding_id: string
          overridden: boolean
          position: number
          proposal_id: string | null
          rationale: string | null
          source_file: string | null
          status: string
          supplier: string
          title: string
        }
        Insert: {
          ai_proposed_buyer?: string | null
          assigned_at?: string | null
          assigned_buyer?: string | null
          assigned_initials?: string | null
          assigned_member_id?: string | null
          assigned_tone?: string | null
          confidence?: string | null
          criticality?: string
          due_date?: string | null
          id?: string
          offboarding_id?: string
          overridden?: boolean
          position?: number
          proposal_id?: string | null
          rationale?: string | null
          source_file?: string | null
          status?: string
          supplier?: string
          title: string
        }
        Update: {
          ai_proposed_buyer?: string | null
          assigned_at?: string | null
          assigned_buyer?: string | null
          assigned_initials?: string | null
          assigned_member_id?: string | null
          assigned_tone?: string | null
          confidence?: string | null
          criticality?: string
          due_date?: string | null
          id?: string
          offboarding_id?: string
          overridden?: boolean
          position?: number
          proposal_id?: string | null
          rationale?: string | null
          source_file?: string | null
          status?: string
          supplier?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_offboarding_id_fkey"
            columns: ["offboarding_id"]
            isOneToOne: false
            referencedRelation: "offboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          capacity: number
          departed: boolean
          expertise: string
          id: string
          initials: string
          name: string
          position: number
          tone: string
          workload: string
        }
        Insert: {
          capacity: number
          departed?: boolean
          expertise: string
          id?: string
          initials: string
          name: string
          position?: number
          tone: string
          workload: string
        }
        Update: {
          capacity?: number
          departed?: boolean
          expertise?: string
          id?: string
          initials?: string
          name?: string
          position?: number
          tone?: string
          workload?: string
        }
        Relationships: []
      }
      workspace_info: {
        Row: {
          departing_buyer_name: string
          departing_buyer_role: string
          departing_on: string
          id: number
        }
        Insert: {
          departing_buyer_name: string
          departing_buyer_role: string
          departing_on: string
          id?: number
        }
        Update: {
          departing_buyer_name?: string
          departing_buyer_role?: string
          departing_on?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_offboarding_allocations: {
        Args: { p_allocations: Json; p_offboarding_id: string }
        Returns: undefined
      }
      apply_task_allocations: {
        Args: { p_allocations: Json }
        Returns: undefined
      }
      approve_offboarding_tasks: {
        Args: { p_offboarding_id: string }
        Returns: undefined
      }
      approve_remaining_tasks: { Args: never; Returns: undefined }
      chunk_document_text: {
        Args: { p_content: string; p_target?: number }
        Returns: {
          chunk_index: number
          content: string
        }[]
      }
      index_document: { Args: { p_document_id: string }; Returns: number }
      reset_task_demo: { Args: never; Returns: undefined }
      review_task: {
        Args: {
          p_action: string
          p_buyer_id?: string
          p_reason?: string
          p_task_id: string
        }
        Returns: undefined
      }
      search_chunks: {
        Args: { p_limit?: number; p_question: string }
        Returns: {
          chunk_id: number
          content: string
          document_id: string
          filename: string
          score: number
        }[]
      }
      search_offboarding_chunks: {
        Args: { p_limit?: number; p_offboarding_id: string; p_question: string }
        Returns: {
          chunk_id: number
          content: string
          document_id: string
          filename: string
          score: number
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
