export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'owner' | 'admin' | 'analyst' | 'viewer'
export type EntityType = 'individual' | 'company' | 'trust' | 'partnership' | 'other'
export type InvestigationStatus = 'active' | 'pending_review' | 'completed' | 'escalated' | 'archived'
export type ScreeningType = 'sanctions' | 'pep' | 'adverse_media' | 'registry'
export type ScreeningStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ReportStatus = 'draft' | 'in_review' | 'final' | 'archived'
export type ReportTemplate = 'standard_dd' | 'enhanced_dd' | 'sanctions_alert' | 'periodic_review'
export type LinkType = 'ownership' | 'control' | 'nominee' | 'beneficial_owner' | 'other'

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          slug: string
          settings: Json
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          settings?: Json
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          settings?: Json
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          org_id: string
          role: UserRole
          full_name: string
          avatar_url: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          role?: UserRole
          full_name: string
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: UserRole
          full_name?: string
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      entities: {
        Row: {
          id: string
          org_id: string
          name: string
          type: EntityType
          jurisdiction: string | null
          registration_number: string | null
          date_of_birth: string | null
          address: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          type?: EntityType
          jurisdiction?: string | null
          registration_number?: string | null
          date_of_birth?: string | null
          address?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          type?: EntityType
          jurisdiction?: string | null
          registration_number?: string | null
          date_of_birth?: string | null
          address?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      investigations: {
        Row: {
          id: string
          org_id: string
          entity_id: string
          status: InvestigationStatus
          risk_score: number | null
          assigned_to: string | null
          due_date: string | null
          summary: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          entity_id: string
          status?: InvestigationStatus
          risk_score?: number | null
          assigned_to?: string | null
          due_date?: string | null
          summary?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          entity_id?: string
          status?: InvestigationStatus
          risk_score?: number | null
          assigned_to?: string | null
          due_date?: string | null
          summary?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      screening_results: {
        Row: {
          id: string
          investigation_id: string
          type: ScreeningType
          status: ScreeningStatus
          hit_count: number
          raw_data: Json
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          type: ScreeningType
          status?: ScreeningStatus
          hit_count?: number
          raw_data?: Json
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          type?: ScreeningType
          status?: ScreeningStatus
          hit_count?: number
          raw_data?: Json
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      screening_hits: {
        Row: {
          id: string
          result_id: string
          source: string
          match_score: number
          matched_name: string | null
          data: Json
          is_confirmed: boolean | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          result_id: string
          source: string
          match_score: number
          matched_name?: string | null
          data?: Json
          is_confirmed?: boolean | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          result_id?: string
          source?: string
          match_score?: number
          matched_name?: string | null
          data?: Json
          is_confirmed?: boolean | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          investigation_id: string
          org_id: string
          file_name: string
          file_path: string
          file_type: string
          file_size_bytes: number | null
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          org_id: string
          file_name: string
          file_path: string
          file_type: string
          file_size_bytes?: number | null
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          org_id?: string
          file_name?: string
          file_path?: string
          file_type?: string
          file_size_bytes?: number | null
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          investigation_id: string
          org_id: string
          template: ReportTemplate
          status: ReportStatus
          title: string
          content: Json
          generated_by: string | null
          approved_by: string | null
          approved_at: string | null
          share_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          org_id: string
          template?: ReportTemplate
          status?: ReportStatus
          title: string
          content?: Json
          generated_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          share_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          org_id?: string
          template?: ReportTemplate
          status?: ReportStatus
          title?: string
          content?: Json
          generated_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          share_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      timeline_events: {
        Row: {
          id: string
          investigation_id: string
          event_type: string
          title: string
          description: string | null
          data: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          event_type: string
          title: string
          description?: string | null
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          event_type?: string
          title?: string
          description?: string | null
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      analyst_notes: {
        Row: {
          id: string
          investigation_id: string
          content: string
          author_id: string
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          content: string
          author_id: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          content?: string
          author_id?: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          org_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions: Json
          is_active: boolean
          last_used_at: string | null
          expires_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions?: Json
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          key_hash?: string
          key_prefix?: string
          permissions?: Json
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          data: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          data?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          data?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      risk_scoring_rules: {
        Row: {
          id: string
          org_id: string
          factor: string
          weight: number
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          factor: string
          weight?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          factor?: string
          weight?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ownership_links: {
        Row: {
          id: string
          parent_entity_id: string
          child_entity_id: string
          org_id: string
          ownership_pct: number | null
          link_type: LinkType
          is_verified: boolean
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_entity_id: string
          child_entity_id: string
          org_id: string
          ownership_pct?: number | null
          link_type?: LinkType
          is_verified?: boolean
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_entity_id?: string
          child_entity_id?: string
          org_id?: string
          ownership_pct?: number | null
          link_type?: LinkType
          is_verified?: boolean
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_org_id_for_user: {
        Args: { user_id: string }
        Returns: string
      }
      get_investigation_risk_score: {
        Args: { investigation_uuid: string }
        Returns: number
      }
    }
    Enums: {
      user_role: UserRole
      entity_type: EntityType
      investigation_status: InvestigationStatus
      screening_type: ScreeningType
      screening_status: ScreeningStatus
      report_status: ReportStatus
      report_template: ReportTemplate
      link_type: LinkType
    }
  }
}

// ──────────────────────────────────────────────
// Generic helpers
// ──────────────────────────────────────────────

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

export type DbFunctions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T]
