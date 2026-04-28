// 自動生成用プレースホルダ。
// Supabase CLI が起動したら `npm run db:types` で実体に置き換わる：
//   supabase gen types typescript --local > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type PriceRange =
  | '〜2000'
  | '2000〜5000'
  | '5000〜10000'
  | '10000〜20000'
  | '20000〜'

type Timestamps = { created_at: string }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
        } & Timestamps
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: Partial<{
          display_name: string
          avatar_url: string | null
        }>
        Relationships: []
      }
      genres: {
        Row: {
          id: string
          name: string
          created_by: string | null
        } & Timestamps
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<{ name: string }>
        Relationships: []
      }
      restaurants: {
        Row: {
          id: string
          name: string
          link: string | null
          genre_id: string
          price_range: PriceRange
          created_by: string | null
        } & Timestamps
        Insert: {
          id?: string
          name: string
          link?: string | null
          genre_id: string
          price_range: PriceRange
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<{
          name: string
          link: string | null
          genre_id: string
          price_range: PriceRange
        }>
        Relationships: []
      }
      visits: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          visit_date: string | null
          order_content: string | null
          payment_amount: number | null
        } & Timestamps
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          visit_date?: string | null
          order_content?: string | null
          payment_amount?: number | null
          created_at?: string
        }
        Update: Partial<{
          visit_date: string | null
          order_content: string | null
          payment_amount: number | null
        }>
        Relationships: []
      }
      ratings: {
        Row: {
          id: string
          visit_id: string
          overall: number
          food: number
          service: number
          atmosphere: number
          cost_performance: number
        }
        Insert: {
          id?: string
          visit_id: string
          overall: number
          food: number
          service: number
          atmosphere: number
          cost_performance: number
        }
        Update: Partial<{
          overall: number
          food: number
          service: number
          atmosphere: number
          cost_performance: number
        }>
        Relationships: []
      }
      health: {
        Row: { id: number; pinged_at: string }
        Insert: { id?: number; pinged_at?: string }
        Update: Partial<{ pinged_at: string }>
        Relationships: []
      }
    }
    Views: {
      restaurant_rating_summary: {
        Row: {
          restaurant_id: string
          rating_count: number
          avg_overall: number | null
          avg_food: number | null
          avg_service: number | null
          avg_atmosphere: number | null
          avg_cost_performance: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: { price_range_enum: PriceRange }
    CompositeTypes: Record<string, never>
  }
}
