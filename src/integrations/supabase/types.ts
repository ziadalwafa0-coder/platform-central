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
      sr_circuit_state: {
        Row: {
          consecutive_failures: number
          last_error: string | null
          last_failure_at: string | null
          next_probe_at: string | null
          opened_at: string | null
          platform: string
          state: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          last_error?: string | null
          last_failure_at?: string | null
          next_probe_at?: string | null
          opened_at?: string | null
          platform: string
          state?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          last_error?: string | null
          last_failure_at?: string | null
          next_probe_at?: string | null
          opened_at?: string | null
          platform?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      sr_dead_letter: {
        Row: {
          attempts: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: number
          kind: string
          last_attempt_at: string | null
          payload: Json
          platform: string
          resolved_at: string | null
          run_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          kind: string
          last_attempt_at?: string | null
          payload: Json
          platform?: string
          resolved_at?: string | null
          run_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          kind?: string
          last_attempt_at?: string | null
          payload?: Json
          platform?: string
          resolved_at?: string | null
          run_id?: string | null
        }
        Relationships: []
      }
      sr_health_metrics: {
        Row: {
          id: number
          metric: string
          observed_at: string
          tags: Json | null
          value: number
        }
        Insert: {
          id?: number
          metric: string
          observed_at?: string
          tags?: Json | null
          value: number
        }
        Update: {
          id?: number
          metric?: string
          observed_at?: string
          tags?: Json | null
          value?: number
        }
        Relationships: []
      }
      sr_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          result: Json | null
          run_id: string | null
          scope: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          result?: Json | null
          run_id?: string | null
          scope: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          result?: Json | null
          run_id?: string | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      sr_products: {
        Row: {
          category: string | null
          currency: string | null
          current_quantity: number | null
          external_product_id: string
          first_seen_at: string
          id: string
          image_url: string | null
          last_checked_at: string
          name: string
          platform: string
          previous_quantity: number | null
          price: number | null
          product_url: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          currency?: string | null
          current_quantity?: number | null
          external_product_id: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          last_checked_at?: string
          name: string
          platform?: string
          previous_quantity?: number | null
          price?: number | null
          product_url?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          currency?: string | null
          current_quantity?: number | null
          external_product_id?: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          last_checked_at?: string
          name?: string
          platform?: string
          previous_quantity?: number | null
          price?: number | null
          product_url?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sr_schema_warnings: {
        Row: {
          field_path: string
          first_seen_at: string
          id: number
          last_seen_at: string
          occurrences: number
          platform: string
          sample_value: Json | null
        }
        Insert: {
          field_path: string
          first_seen_at?: string
          id?: number
          last_seen_at?: string
          occurrences?: number
          platform?: string
          sample_value?: Json | null
        }
        Update: {
          field_path?: string
          first_seen_at?: string
          id?: number
          last_seen_at?: string
          occurrences?: number
          platform?: string
          sample_value?: Json | null
        }
        Relationships: []
      }
      sr_snapshots: {
        Row: {
          current_quantity: number | null
          external_product_id: string
          id: number
          observed_at: string
          platform: string
          previous_quantity: number | null
          quantity_decrease: number
          restock_amount: number
        }
        Insert: {
          current_quantity?: number | null
          external_product_id: string
          id?: number
          observed_at?: string
          platform?: string
          previous_quantity?: number | null
          quantity_decrease?: number
          restock_amount?: number
        }
        Update: {
          current_quantity?: number | null
          external_product_id?: string
          id?: number
          observed_at?: string
          platform?: string
          previous_quantity?: number | null
          quantity_decrease?: number
          restock_amount?: number
        }
        Relationships: []
      }
      sr_sync_logs: {
        Row: {
          code: string | null
          external_product_id: string | null
          id: number
          level: string
          message: string
          meta: Json | null
          observed_at: string
          page: number | null
          run_id: string | null
        }
        Insert: {
          code?: string | null
          external_product_id?: string | null
          id?: number
          level?: string
          message: string
          meta?: Json | null
          observed_at?: string
          page?: number | null
          run_id?: string | null
        }
        Update: {
          code?: string | null
          external_product_id?: string | null
          id?: number
          level?: string
          message?: string
          meta?: Json | null
          observed_at?: string
          page?: number | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sr_sync_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sr_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sr_sync_runs: {
        Row: {
          cancel_requested: boolean
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          inventory_delta: number
          manual_or_auto: string
          pages_fetched: number
          platform: string
          products_failed: number
          products_inserted: number
          products_processed: number
          products_total: number
          products_updated: number
          restock_delta: number
          started_at: string
          status: string
          total_inventory: number
          triggered_by: string | null
          withdrawal_delta: number
        }
        Insert: {
          cancel_requested?: boolean
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inventory_delta?: number
          manual_or_auto?: string
          pages_fetched?: number
          platform?: string
          products_failed?: number
          products_inserted?: number
          products_processed?: number
          products_total?: number
          products_updated?: number
          restock_delta?: number
          started_at?: string
          status?: string
          total_inventory?: number
          triggered_by?: string | null
          withdrawal_delta?: number
        }
        Update: {
          cancel_requested?: boolean
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inventory_delta?: number
          manual_or_auto?: string
          pages_fetched?: number
          platform?: string
          products_failed?: number
          products_inserted?: number
          products_processed?: number
          products_total?: number
          products_updated?: number
          restock_delta?: number
          started_at?: string
          status?: string
          total_inventory?: number
          triggered_by?: string | null
          withdrawal_delta?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reap_stuck_sync_runs: {
        Args: { _older_than_minutes?: number }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
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
      app_role: ["admin", "manager", "viewer"],
    },
  },
} as const
