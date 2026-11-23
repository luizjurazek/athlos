// Hand-written in the `supabase gen types typescript` shape, so it can be swapped for the generated
// file once the Supabase CLI is set up. Keep in sync with supabase/migrations.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      objectives: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          color: string | null;
          icon: string | null;
          weekdays: number[];
          reschedulable: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          color?: string | null;
          icon?: string | null;
          weekdays?: number[];
          reschedulable?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          color?: string | null;
          icon?: string | null;
          weekdays?: number[];
          reschedulable?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      objective_checks: {
        Row: {
          id: string;
          user_id: string;
          objective_id: string;
          day: string;
          checked_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          objective_id: string;
          day: string;
          checked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          objective_id?: string;
          day?: string;
          checked_at?: string;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
