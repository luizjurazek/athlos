export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      goal_objectives: {
        Row: {
          goal_id: string;
          objective_id: string;
          user_id: string;
        };
        Insert: {
          goal_id: string;
          objective_id: string;
          user_id?: string;
        };
        Update: {
          goal_id?: string;
          objective_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_objectives_goal_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "goal_objectives_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goal_stages: {
        Row: {
          completed_at: string | null;
          due_on: string;
          goal_id: string;
          id: string;
          position: number;
          target_count: number;
          title: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          due_on: string;
          goal_id: string;
          id?: string;
          position: number;
          target_count: number;
          title: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          due_on?: string;
          goal_id?: string;
          id?: string;
          position?: number;
          target_count?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_stages_goal_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          description: string | null;
          due_on: string;
          id: string;
          starts_on: string;
          status: Database["public"]["Enums"]["goal_status"];
          title: string;
          unit_label: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          due_on: string;
          id?: string;
          starts_on: string;
          status?: Database["public"]["Enums"]["goal_status"];
          title: string;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          due_on?: string;
          id?: string;
          starts_on?: string;
          status?: Database["public"]["Enums"]["goal_status"];
          title?: string;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      objective_checks: {
        Row: {
          checked_at: string;
          day: string;
          id: string;
          objective_id: string;
          user_id: string;
        };
        Insert: {
          checked_at?: string;
          day: string;
          id?: string;
          objective_id: string;
          user_id?: string;
        };
        Update: {
          checked_at?: string;
          day?: string;
          id?: string;
          objective_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objective_checks_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      objectives: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          icon: string | null;
          id: string;
          reschedulable: boolean;
          title: string;
          updated_at: string;
          user_id: string;
          weekdays: number[];
        };
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          reschedulable?: boolean;
          title: string;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          reschedulable?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      goal_stage_progress: {
        Row: {
          checks_count: number | null;
          due_on: string | null;
          goal_id: string | null;
          position: number | null;
          stage_id: string | null;
          target_count: number | null;
          window_start: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      save_goal: {
        Args: { goal: Json; objective_ids: string[]; stages: Json };
        Returns: string;
      };
    };
    Enums: {
      goal_status: "active" | "completed" | "expired" | "abandoned";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      goal_status: ["active", "completed", "expired", "abandoned"],
    },
  },
} as const;
