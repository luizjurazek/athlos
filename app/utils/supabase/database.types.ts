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
      activity_sessions: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"];
          created_at: string;
          day: string;
          id: string;
          notes: string | null;
          objective_id: string;
          updated_at: string;
          user_id: string;
          workout_id: string | null;
        };
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"];
          created_at?: string;
          day: string;
          id?: string;
          notes?: string | null;
          objective_id: string;
          updated_at?: string;
          user_id?: string;
          workout_id?: string | null;
        };
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"];
          created_at?: string;
          day?: string;
          id?: string;
          notes?: string | null;
          objective_id?: string;
          updated_at?: string;
          user_id?: string;
          workout_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_sessions_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "activity_sessions_workout_fkey";
            columns: ["workout_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goal_entries: {
        Row: {
          amount: number;
          created_at: string;
          day: string;
          goal_id: string;
          id: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          day: string;
          goal_id: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          day?: string;
          goal_id?: string;
          id?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_entries_goal_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
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
      goal_stage_targets: {
        Row: {
          goal_id: string;
          objective_id: string;
          stage_id: string;
          target_count: number;
          user_id: string;
        };
        Insert: {
          goal_id: string;
          objective_id: string;
          stage_id: string;
          target_count: number;
          user_id?: string;
        };
        Update: {
          goal_id?: string;
          objective_id?: string;
          stage_id?: string;
          target_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_stage_targets_link_fkey";
            columns: ["goal_id", "objective_id"];
            isOneToOne: false;
            referencedRelation: "goal_objectives";
            referencedColumns: ["goal_id", "objective_id"];
          },
          {
            foreignKeyName: "goal_stage_targets_stage_fkey";
            columns: ["stage_id", "goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goal_stages";
            referencedColumns: ["id", "goal_id", "user_id"];
          },
        ];
      };
      goal_stages: {
        Row: {
          completed_at: string | null;
          completed_manually_on: string | null;
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
          completed_manually_on?: string | null;
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
          completed_manually_on?: string | null;
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
          completed_manually_on: string | null;
          created_at: string;
          description: string | null;
          due_on: string;
          id: string;
          progress_source: Database["public"]["Enums"]["goal_progress_source"];
          starts_on: string;
          status: Database["public"]["Enums"]["goal_status"];
          title: string;
          unit_label: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_manually_on?: string | null;
          created_at?: string;
          description?: string | null;
          due_on: string;
          id?: string;
          progress_source?: Database["public"]["Enums"]["goal_progress_source"];
          starts_on: string;
          status?: Database["public"]["Enums"]["goal_status"];
          title: string;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_manually_on?: string | null;
          created_at?: string;
          description?: string | null;
          due_on?: string;
          id?: string;
          progress_source?: Database["public"]["Enums"]["goal_progress_source"];
          starts_on?: string;
          status?: Database["public"]["Enums"]["goal_status"];
          title?: string;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      objective_additions: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          objective_id: string;
          replaced_objective_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          id?: string;
          objective_id: string;
          replaced_objective_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          objective_id?: string;
          replaced_objective_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objective_additions_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "objective_additions_replaced_objective_fkey";
            columns: ["replaced_objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      objective_alternatives: {
        Row: {
          alternative_id: string;
          created_at: string;
          objective_id: string;
          user_id: string;
        };
        Insert: {
          alternative_id: string;
          created_at?: string;
          objective_id: string;
          user_id?: string;
        };
        Update: {
          alternative_id?: string;
          created_at?: string;
          objective_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objective_alternatives_alternative_fkey";
            columns: ["alternative_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "objective_alternatives_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
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
      objective_reschedules: {
        Row: {
          created_at: string;
          from_day: string;
          id: string;
          objective_id: string;
          to_day: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          from_day: string;
          id?: string;
          objective_id: string;
          to_day: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          from_day?: string;
          id?: string;
          objective_id?: string;
          to_day?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objective_reschedules_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      objectives: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"] | null;
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
          activity_type?: Database["public"]["Enums"]["activity_type"] | null;
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
          activity_type?: Database["public"]["Enums"]["activity_type"] | null;
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
      workout_exercise_loads: {
        Row: {
          created_at: string;
          effective_from: string;
          id: string;
          load_kg: number | null;
          reps: number;
          sets: number;
          user_id: string;
          workout_exercise_id: string;
        };
        Insert: {
          created_at?: string;
          effective_from: string;
          id?: string;
          load_kg?: number | null;
          reps: number;
          sets: number;
          user_id?: string;
          workout_exercise_id: string;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          id?: string;
          load_kg?: number | null;
          reps?: number;
          sets?: number;
          user_id?: string;
          workout_exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercise_loads_exercise_fkey";
            columns: ["workout_exercise_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercises";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      workout_exercises: {
        Row: {
          archived_at: string | null;
          copied_from_id: string | null;
          created_at: string;
          equipment: string | null;
          id: string;
          image_url: string | null;
          muscles: string[] | null;
          name: string;
          notes: string | null;
          position: number;
          source: string | null;
          source_id: string | null;
          updated_at: string;
          user_id: string;
          workout_id: string;
        };
        Insert: {
          archived_at?: string | null;
          copied_from_id?: string | null;
          created_at?: string;
          equipment?: string | null;
          id?: string;
          image_url?: string | null;
          muscles?: string[] | null;
          name: string;
          notes?: string | null;
          position: number;
          source?: string | null;
          source_id?: string | null;
          updated_at?: string;
          user_id?: string;
          workout_id: string;
        };
        Update: {
          archived_at?: string | null;
          copied_from_id?: string | null;
          created_at?: string;
          equipment?: string | null;
          id?: string;
          image_url?: string | null;
          muscles?: string[] | null;
          name?: string;
          notes?: string | null;
          position?: number;
          source?: string | null;
          source_id?: string | null;
          updated_at?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercises_copied_from_fkey";
            columns: ["copied_from_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercises";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "workout_exercises_workout_fkey";
            columns: ["workout_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      workout_plans: {
        Row: {
          created_at: string;
          ended_on: string | null;
          id: string;
          objective_id: string | null;
          started_on: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ended_on?: string | null;
          id?: string;
          objective_id?: string | null;
          started_on: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          ended_on?: string | null;
          id?: string;
          objective_id?: string | null;
          started_on?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plans_objective_fkey";
            columns: ["objective_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "objectives";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      workout_schedule: {
        Row: {
          plan_id: string;
          user_id: string;
          weekday: number;
          workout_id: string;
        };
        Insert: {
          plan_id: string;
          user_id?: string;
          weekday: number;
          workout_id: string;
        };
        Update: {
          plan_id?: string;
          user_id?: string;
          weekday?: number;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_schedule_plan_fkey";
            columns: ["plan_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "workout_schedule_workout_fkey";
            columns: ["workout_id", "plan_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id", "plan_id", "user_id"];
          },
        ];
      };
      workouts: {
        Row: {
          description: string | null;
          id: string;
          label: string;
          plan_id: string;
          position: number;
          user_id: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          label: string;
          plan_id: string;
          position: number;
          user_id?: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          label?: string;
          plan_id?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workouts_plan_fkey";
            columns: ["plan_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      goal_stage_objective_progress: {
        Row: {
          checks_count: number | null;
          goal_id: string | null;
          objective_id: string | null;
          stage_id: string | null;
          target_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "goal_stage_targets_link_fkey";
            columns: ["goal_id", "objective_id"];
            isOneToOne: false;
            referencedRelation: "goal_objectives";
            referencedColumns: ["goal_id", "objective_id"];
          },
        ];
      };
      goal_stage_progress: {
        Row: {
          checks_count: number | null;
          due_on: string | null;
          goal_id: string | null;
          position: number | null;
          stage_id: string | null;
          target_count: number | null;
          window_end: string | null;
          window_start: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_objective_to_day: {
        Args: {
          day: string;
          mark_done?: boolean;
          objective_id: string;
          replaced_objective_id?: string;
        };
        Returns: string;
      };
      reschedule_objective: {
        Args: {
          from_day: string;
          mark_done?: boolean;
          objective_id: string;
          to_day: string;
        };
        Returns: string;
      };
      save_goal: {
        Args: { goal: Json; objective_ids: string[]; stages: Json };
        Returns: string;
      };
      save_workout_load: {
        Args: {
          day: string;
          load_kg?: number;
          reps: number;
          sets: number;
          workout_exercise_id: string;
        };
        Returns: boolean;
      };
      start_workout_plan: {
        Args: {
          objective_id: string;
          schedule?: Json;
          started_on: string;
          title: string;
          workouts: Json;
        };
        Returns: string;
      };
      workout_loads_on: {
        Args: { day: string; plan_id: string };
        Returns: {
          effective_from: string;
          load_kg: number;
          reps: number;
          sets: number;
          workout_exercise_id: string;
          workout_id: string;
        }[];
      };
    };
    Enums: {
      activity_type: "gym";
      goal_progress_source: "checks" | "entries";
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
      activity_type: ["gym"],
      goal_progress_source: ["checks", "entries"],
      goal_status: ["active", "completed", "expired", "abandoned"],
    },
  },
} as const;
