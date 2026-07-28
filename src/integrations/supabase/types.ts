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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brokerage_holdings: {
        Row: {
          asset_class: string | null
          brokerage_id: string
          cost_basis: number | null
          currency: string | null
          id: string
          market_value: number | null
          name: string | null
          quantity: number
          sector: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_class?: string | null
          brokerage_id: string
          cost_basis?: number | null
          currency?: string | null
          id?: string
          market_value?: number | null
          name?: string | null
          quantity?: number
          sector?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_class?: string | null
          brokerage_id?: string
          cost_basis?: number | null
          currency?: string | null
          id?: string
          market_value?: number | null
          name?: string | null
          quantity?: number
          sector?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brokerage_holdings_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "linked_brokerages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          forecasts: Json | null
          id: string
          is_error: boolean
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          forecasts?: Json | null
          id?: string
          is_error?: boolean
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          forecasts?: Json | null
          id?: string
          is_error?: boolean
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fundamentals: {
        Row: {
          debt_to_equity: number | null
          dividend_yield: number | null
          eps: number | null
          eps_beat_streak: number | null
          eps_miss_streak: number | null
          fcf_growth: number | null
          forward_pe: number | null
          fundamental_score: number | null
          pe_ratio: number | null
          profit_margins: number | null
          revenue_growth: number | null
          sector: string | null
          sector_avg_pe: number | null
          symbol: string
          updated_at: string
        }
        Insert: {
          debt_to_equity?: number | null
          dividend_yield?: number | null
          eps?: number | null
          eps_beat_streak?: number | null
          eps_miss_streak?: number | null
          fcf_growth?: number | null
          forward_pe?: number | null
          fundamental_score?: number | null
          pe_ratio?: number | null
          profit_margins?: number | null
          revenue_growth?: number | null
          sector?: string | null
          sector_avg_pe?: number | null
          symbol: string
          updated_at?: string
        }
        Update: {
          debt_to_equity?: number | null
          dividend_yield?: number | null
          eps?: number | null
          eps_beat_streak?: number | null
          eps_miss_streak?: number | null
          fcf_growth?: number | null
          forward_pe?: number | null
          fundamental_score?: number | null
          pe_ratio?: number | null
          profit_margins?: number | null
          revenue_growth?: number | null
          sector?: string | null
          sector_avg_pe?: number | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      investing_philosophy: {
        Row: {
          asset_allocation_rules: string | null
          id: string
          market_insights_style: string | null
          philosophy_text: string
          risk_guidance: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asset_allocation_rules?: string | null
          id?: string
          market_insights_style?: string | null
          philosophy_text: string
          risk_guidance?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asset_allocation_rules?: string | null
          id?: string
          market_insights_style?: string | null
          philosophy_text?: string
          risk_guidance?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      investment_assessments: {
        Row: {
          created_at: string
          date_of_birth: string
          id: string
          income_stability: string
          investment_amount: number
          investment_experience: string
          investment_goal: string
          investment_timeline: string
          recurring_amount: number | null
          recurring_frequency: string | null
          recurring_investment: boolean
          risk_tolerance: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          id?: string
          income_stability: string
          investment_amount: number
          investment_experience: string
          investment_goal: string
          investment_timeline: string
          recurring_amount?: number | null
          recurring_frequency?: string | null
          recurring_investment?: boolean
          risk_tolerance: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          id?: string
          income_stability?: string
          investment_amount?: number
          investment_experience?: string
          investment_goal?: string
          investment_timeline?: string
          recurring_amount?: number | null
          recurring_frequency?: string | null
          recurring_investment?: boolean
          risk_tolerance?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linked_brokerages: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          institution_name: string
          last_sync_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plaid_items: {
        Row: {
          access_token: string
          brokerage_id: string
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          access_token: string
          brokerage_id: string
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          access_token?: string
          brokerage_id?: string
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plaid_items_brokerage_id_fkey"
            columns: ["brokerage_id"]
            isOneToOne: false
            referencedRelation: "linked_brokerages"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_recommendations: {
        Row: {
          allocation_alternatives: number
          allocation_bonds: number
          allocation_cash: number
          allocation_etfs: number
          allocation_stocks: number
          assessment_id: string
          created_at: string
          id: string
          rationale: string | null
          recommended_funds: Json
          user_id: string
        }
        Insert: {
          allocation_alternatives?: number
          allocation_bonds: number
          allocation_cash: number
          allocation_etfs: number
          allocation_stocks: number
          assessment_id: string
          created_at?: string
          id?: string
          rationale?: string | null
          recommended_funds: Json
          user_id: string
        }
        Update: {
          allocation_alternatives?: number
          allocation_bonds?: number
          allocation_cash?: number
          allocation_etfs?: number
          allocation_stocks?: number
          assessment_id?: string
          created_at?: string
          id?: string
          rationale?: string | null
          recommended_funds?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_recommendations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "investment_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_holdings: {
        Row: {
          avg_cost_basis: number
          created_at: string
          id: string
          name: string
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost_basis?: number
          created_at?: string
          id?: string
          name: string
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost_basis?: number
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_portfolios: {
        Row: {
          cash_balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_trades: {
        Row: {
          created_at: string
          id: string
          name: string
          price_per_share: number
          quantity: number
          symbol: string
          total_amount: number
          trade_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price_per_share: number
          quantity: number
          symbol: string
          total_amount: number
          trade_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price_per_share?: number
          quantity?: number
          symbol?: string
          total_amount?: number
          trade_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      securities: {
        Row: {
          created_at: string
          exchange: string | null
          id: string
          ipo_date: string | null
          is_active: boolean
          name: string
          sector: string | null
          source: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange?: string | null
          id?: string
          ipo_date?: string | null
          is_active?: boolean
          name: string
          sector?: string | null
          source?: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange?: string | null
          id?: string
          ipo_date?: string | null
          is_active?: boolean
          name?: string
          sector?: string | null
          source?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      securities_universe: {
        Row: {
          asset_type: string
          exchange: string | null
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          asset_type?: string
          exchange?: string | null
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          exchange?: string | null
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      technicals: {
        Row: {
          avg_volume: number | null
          change_pct: number | null
          fifty_two_week_high: number | null
          fifty_two_week_low: number | null
          macd_hist: number | null
          macd_prev_hist: number | null
          market_cap: number | null
          price: number | null
          rsi_14: number | null
          sma_200: number | null
          sma_200_prev: number | null
          sma_50: number | null
          sma_50_prev: number | null
          symbol: string
          technical_score: number | null
          updated_at: string
          volume: number | null
          volume_score: number | null
        }
        Insert: {
          avg_volume?: number | null
          change_pct?: number | null
          fifty_two_week_high?: number | null
          fifty_two_week_low?: number | null
          macd_hist?: number | null
          macd_prev_hist?: number | null
          market_cap?: number | null
          price?: number | null
          rsi_14?: number | null
          sma_200?: number | null
          sma_200_prev?: number | null
          sma_50?: number | null
          sma_50_prev?: number | null
          symbol: string
          technical_score?: number | null
          updated_at?: string
          volume?: number | null
          volume_score?: number | null
        }
        Update: {
          avg_volume?: number | null
          change_pct?: number | null
          fifty_two_week_high?: number | null
          fifty_two_week_low?: number | null
          macd_hist?: number | null
          macd_prev_hist?: number | null
          market_cap?: number | null
          price?: number | null
          rsi_14?: number | null
          sma_200?: number | null
          sma_200_prev?: number | null
          sma_50?: number | null
          sma_50_prev?: number | null
          symbol?: string
          technical_score?: number | null
          updated_at?: string
          volume?: number | null
          volume_score?: number | null
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
      screener_view: {
        Row: {
          asset_type: string | null
          avg_volume: number | null
          change_pct: number | null
          combined_score: number | null
          debt_to_equity: number | null
          dividend_yield: number | null
          eps: number | null
          eps_beat_streak: number | null
          eps_miss_streak: number | null
          exchange: string | null
          fcf_growth: number | null
          fifty_two_week_high: number | null
          fifty_two_week_low: number | null
          forward_pe: number | null
          fundamental_score: number | null
          macd_hist: number | null
          macd_prev_hist: number | null
          market_cap: number | null
          name: string | null
          pe_ratio: number | null
          price: number | null
          profit_margins: number | null
          revenue_growth: number | null
          rsi_14: number | null
          sector: string | null
          sector_avg_pe: number | null
          sma_200: number | null
          sma_200_prev: number | null
          sma_50: number | null
          sma_50_prev: number | null
          symbol: string | null
          technical_score: number | null
          volume: number | null
          volume_score: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
