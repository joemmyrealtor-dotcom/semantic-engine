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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string
          governing_prompt_ids: string[]
          id: string
          name: string
          responsibilities: string[]
          role: string
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          governing_prompt_ids?: string[]
          id: string
          name: string
          responsibilities?: string[]
          role?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          governing_prompt_ids?: string[]
          id?: string
          name?: string
          responsibilities?: string[]
          role?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      client_tools: {
        Row: {
          created_at: string
          human_review_completed: boolean
          id: string
          kind: string
          name: string
          prompt_id: string | null
          purpose: string
          source_concept_ids: string[]
          source_framework_ids: string[]
          source_knowledge_object_ids: string[]
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          human_review_completed?: boolean
          id: string
          kind: string
          name: string
          prompt_id?: string | null
          purpose?: string
          source_concept_ids?: string[]
          source_framework_ids?: string[]
          source_knowledge_object_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          human_review_completed?: boolean
          id?: string
          kind?: string
          name?: string
          prompt_id?: string | null
          purpose?: string
          source_concept_ids?: string[]
          source_framework_ids?: string[]
          source_knowledge_object_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      concepts: {
        Row: {
          ai_retrieval_tags: string[]
          aliases: string[]
          audience: string | null
          canonical_definition: string
          canonical_name: string
          created_at: string
          domain_ids: string[]
          exclusions: string
          framework_ids: string[]
          human_review_completed: boolean
          id: string
          keywords: string[]
          last_reviewed_at: string | null
          purpose: string
          reading_level: string | null
          related_concept_ids: string[]
          review_cadence_months: number
          scope: string
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          updated_at: string
          version: string
        }
        Insert: {
          ai_retrieval_tags?: string[]
          aliases?: string[]
          audience?: string | null
          canonical_definition?: string
          canonical_name: string
          created_at?: string
          domain_ids?: string[]
          exclusions?: string
          framework_ids?: string[]
          human_review_completed?: boolean
          id: string
          keywords?: string[]
          last_reviewed_at?: string | null
          purpose?: string
          reading_level?: string | null
          related_concept_ids?: string[]
          review_cadence_months?: number
          scope?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          ai_retrieval_tags?: string[]
          aliases?: string[]
          audience?: string | null
          canonical_definition?: string
          canonical_name?: string
          created_at?: string
          domain_ids?: string[]
          exclusions?: string
          framework_ids?: string[]
          human_review_completed?: boolean
          id?: string
          keywords?: string[]
          last_reviewed_at?: string | null
          purpose?: string
          reading_level?: string | null
          related_concept_ids?: string[]
          review_cadence_months?: number
          scope?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          summary: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          summary?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          summary?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      frameworks: {
        Row: {
          client_tool_ids: string[]
          created_at: string
          decision_flow: string[]
          decision_solved: string
          dependency_ids: string[]
          governing_concept_ids: string[]
          id: string
          inputs: string[]
          maturity: string
          mission: string
          name: string
          outputs: string[]
          publication_ids: string[]
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          updated_at: string
          version: string
        }
        Insert: {
          client_tool_ids?: string[]
          created_at?: string
          decision_flow?: string[]
          decision_solved?: string
          dependency_ids?: string[]
          governing_concept_ids?: string[]
          id: string
          inputs?: string[]
          maturity?: string
          mission?: string
          name: string
          outputs?: string[]
          publication_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          client_tool_ids?: string[]
          created_at?: string
          decision_flow?: string[]
          decision_solved?: string
          dependency_ids?: string[]
          governing_concept_ids?: string[]
          id?: string
          inputs?: string[]
          maturity?: string
          mission?: string
          name?: string
          outputs?: string[]
          publication_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_objects: {
        Row: {
          audience: string | null
          body: string
          created_at: string
          generated_at: string | null
          human_review_completed: boolean
          human_review_required: boolean
          id: string
          prompt_id: string | null
          source_concept_ids: string[]
          source_framework_ids: string[]
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          title: string
          type: string
          updated_at: string
          version: string
        }
        Insert: {
          audience?: string | null
          body?: string
          created_at?: string
          generated_at?: string | null
          human_review_completed?: boolean
          human_review_required?: boolean
          id: string
          prompt_id?: string | null
          source_concept_ids?: string[]
          source_framework_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          title: string
          type: string
          updated_at?: string
          version?: string
        }
        Update: {
          audience?: string | null
          body?: string
          created_at?: string
          generated_at?: string | null
          human_review_completed?: boolean
          human_review_required?: boolean
          id?: string
          prompt_id?: string | null
          source_concept_ids?: string[]
          source_framework_ids?: string[]
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          title?: string
          type?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string
          family: string
          id: string
          inputs: string[]
          name: string
          outputs: string[]
          purpose: string
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          template: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          family: string
          id: string
          inputs?: string[]
          name: string
          outputs?: string[]
          purpose?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          template?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          family?: string
          id?: string
          inputs?: string[]
          name?: string
          outputs?: string[]
          purpose?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          template?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      publication_blueprints: {
        Row: {
          audience: string | null
          chapters: Json
          created_at: string
          id: string
          purpose: string
          status: Database["public"]["Enums"]["asset_status"]
          steward: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          audience?: string | null
          chapters?: Json
          created_at?: string
          id: string
          purpose?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          audience?: string | null
          chapters?: Json
          created_at?: string
          id?: string
          purpose?: string
          status?: Database["public"]["Enums"]["asset_status"]
          steward?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      qa_issues: {
        Row: {
          blocking: boolean
          category: string
          created_at: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["qa_severity"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          blocking?: boolean
          category: string
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["qa_severity"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          blocking?: boolean
          category?: string
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["qa_severity"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          current_count: number
          key: string
          reset_at: string
          updated_at: string
          window_start: string
        }
        Insert: {
          current_count?: number
          key: string
          reset_at?: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          current_count?: number
          key?: string
          reset_at?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      relationships: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          relation: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          relation: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          relation?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          alignment_warnings: number
          blocking_errors: number
          changelog: string[]
          created_at: string
          editorial_review: string
          gate_checklist: Json
          id: string
          known_issues: string[]
          manifest: Json
          migration_notes: string
          name: string
          qa_evidence: string
          release_notes: string
          stage: Database["public"]["Enums"]["release_stage"]
          steward: string | null
          traceability: string
          updated_at: string
          validation_summary: string
          version: string
        }
        Insert: {
          alignment_warnings?: number
          blocking_errors?: number
          changelog?: string[]
          created_at?: string
          editorial_review?: string
          gate_checklist?: Json
          id: string
          known_issues?: string[]
          manifest?: Json
          migration_notes?: string
          name: string
          qa_evidence?: string
          release_notes?: string
          stage?: Database["public"]["Enums"]["release_stage"]
          steward?: string | null
          traceability?: string
          updated_at?: string
          validation_summary?: string
          version: string
        }
        Update: {
          alignment_warnings?: number
          blocking_errors?: number
          changelog?: string[]
          created_at?: string
          editorial_review?: string
          gate_checklist?: Json
          id?: string
          known_issues?: string[]
          manifest?: Json
          migration_notes?: string
          name?: string
          qa_evidence?: string
          release_notes?: string
          stage?: Database["public"]["Enums"]["release_stage"]
          steward?: string | null
          traceability?: string
          updated_at?: string
          validation_summary?: string
          version?: string
        }
        Relationships: []
      }
      review_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          requested_by: string | null
          state: Database["public"]["Enums"]["review_state"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          state?: Database["public"]["Enums"]["review_state"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          requested_by?: string | null
          state?: Database["public"]["Enums"]["review_state"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          author: string | null
          created_at: string
          id: string
          message: string | null
          snapshot: Json
          target_id: string
          target_type: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          message?: string | null
          snapshot: Json
          target_id: string
          target_type: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          message?: string | null
          snapshot?: Json
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
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
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_rate_limit_buckets: { Args: never; Returns: number }
      consume_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
          window_start: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "owner" | "editor" | "reviewer" | "contributor" | "viewer"
      asset_status:
        | "Draft"
        | "In Review"
        | "Approved"
        | "Canonical"
        | "Deprecated"
        | "Archived"
      qa_severity: "info" | "warning" | "error" | "blocker"
      release_stage:
        | "Planned"
        | "Build"
        | "Review"
        | "QA"
        | "Release Candidate"
        | "Canonical"
        | "Archived"
      review_state: "Pending" | "Approved" | "Changes Requested" | "Rejected"
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
      app_role: ["owner", "editor", "reviewer", "contributor", "viewer"],
      asset_status: [
        "Draft",
        "In Review",
        "Approved",
        "Canonical",
        "Deprecated",
        "Archived",
      ],
      qa_severity: ["info", "warning", "error", "blocker"],
      release_stage: [
        "Planned",
        "Build",
        "Review",
        "QA",
        "Release Candidate",
        "Canonical",
        "Archived",
      ],
      review_state: ["Pending", "Approved", "Changes Requested", "Rejected"],
    },
  },
} as const
