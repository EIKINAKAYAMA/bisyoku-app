export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "genres_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health: {
        Row: {
          id: number
          pinged_at: string
        }
        Insert: {
          id: number
          pinged_at?: string
        }
        Update: {
          id?: number
          pinged_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          atmosphere: number
          cost_performance: number
          food: number
          id: string
          overall: number
          service: number
          visit_id: string
        }
        Insert: {
          atmosphere: number
          cost_performance: number
          food: number
          id?: string
          overall: number
          service: number
          visit_id: string
        }
        Update: {
          atmosphere?: number
          cost_performance?: number
          food?: number
          id?: string
          overall?: number
          service?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          created_by: string | null
          genre_id: string
          google_maps_url: string | null
          id: string
          link: string | null
          name: string
          price_range: Database["public"]["Enums"]["price_range_enum"]
          tabelog_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          genre_id: string
          google_maps_url?: string | null
          id?: string
          link?: string | null
          name: string
          price_range: Database["public"]["Enums"]["price_range_enum"]
          tabelog_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          genre_id?: string
          google_maps_url?: string | null
          id?: string
          link?: string | null
          name?: string
          price_range?: Database["public"]["Enums"]["price_range_enum"]
          tabelog_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_content: string | null
          payment_amount: number | null
          restaurant_id: string
          user_id: string
          visit_date: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_content?: string | null
          payment_amount?: number | null
          restaurant_id: string
          user_id: string
          visit_date?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_content?: string | null
          payment_amount?: number | null
          restaurant_id?: string
          user_id?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_rating_summary"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "visits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      restaurant_rating_summary: {
        Row: {
          avg_atmosphere: number | null
          avg_cost_performance: number | null
          avg_food: number | null
          avg_overall: number | null
          avg_service: number | null
          rating_count: number | null
          restaurant_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_invited_user: { Args: never; Returns: boolean }
    }
    Enums: {
      price_range_enum:
        | "〜2000"
        | "2000〜5000"
        | "5000〜10000"
        | "10000〜20000"
        | "20000〜"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      price_range_enum: [
        "〜2000",
        "2000〜5000",
        "5000〜10000",
        "10000〜20000",
        "20000〜",
      ],
    },
  },
} as const

