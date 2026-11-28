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
      analyst_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          investigation_id: string
          is_pinned: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          investigation_id: string
          is_pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          investigation_id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyst_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyst_notes_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          id: string
          investigation_id: string
          org_id: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          investigation_id: string
          org_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          investigation_id?: string
          org_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          data: Json
          id: string
          ip_address: unknown
          org_id: string
          resource_id: string | null
          resource_type: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          data?: Json
          id?: string
          ip_address?: unknown
          org_id: string
          resource_id?: string | null
          resource_type: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          data?: Json
          id?: string
          ip_address?: unknown
          org_id?: string
          resource_id?: string | null
          resource_type?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          application_id: string
          created_at: string
          decided_by: string
          decision_type: string
          id: string
          org_id: string
          rationale: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          decided_by: string
          decision_type: string
          id?: string
          org_id: string
          rationale: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          decided_by?: string
          decision_type?: string
          id?: string
          org_id?: string
          rationale?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          file_type: string
          id: string
          investigation_id: string
          org_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          file_type: string
          id?: string
          investigation_id: string
          org_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          investigation_id?: string
          org_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      edd_assessments: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          investigation_id: string
          notes: string | null
          org_id: string
          risk_factors: Json
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          investigation_id: string
          notes?: string | null
          org_id: string
          risk_factors?: Json
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          investigation_id?: string
          notes?: string | null
          org_id?: string
          risk_factors?: Json
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edd_assessments_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edd_assessments_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: true
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edd_assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edd_assessments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          address: string | null
          counterparty_type: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          jurisdiction: string | null
          metadata: Json
          name: string
          org_id: string
          registration_number: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          counterparty_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          jurisdiction?: string | null
          metadata?: Json
          name: string
          org_id: string
          registration_number?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          counterparty_type?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          jurisdiction?: string | null
          metadata?: Json
          name?: string
          org_id?: string
          registration_number?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          escalated_by: string
          id: string
          investigation_id: string
          org_id: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          escalated_by: string
          id?: string
          investigation_id: string
          org_id: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          escalated_by?: string
          id?: string
          investigation_id?: string
          org_id?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          due_date: string | null
          entity_id: string
          id: string
          last_screened_at: string | null
          org_id: string
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          override_risk_score: number | null
          parent_investigation_id: string | null
          risk_score: number | null
          status: Database["public"]["Enums"]["investigation_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          entity_id: string
          id?: string
          last_screened_at?: string | null
          org_id: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          override_risk_score?: number | null
          parent_investigation_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["investigation_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          entity_id?: string
          id?: string
          last_screened_at?: string | null
          org_id?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          override_risk_score?: number | null
          parent_investigation_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["investigation_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_parent_investigation_id_fkey"
            columns: ["parent_investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ownership_links: {
        Row: {
          child_entity_id: string
          created_at: string
          id: string
          is_verified: boolean
          link_type: Database["public"]["Enums"]["link_type"]
          org_id: string
          ownership_pct: number | null
          parent_entity_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          child_entity_id: string
          created_at?: string
          id?: string
          is_verified?: boolean
          link_type?: Database["public"]["Enums"]["link_type"]
          org_id: string
          ownership_pct?: number | null
          parent_entity_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          child_entity_id?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          link_type?: Database["public"]["Enums"]["link_type"]
          org_id?: string
          ownership_pct?: number | null
          parent_entity_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_links_child_entity_id_fkey"
            columns: ["child_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_links_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: Json
          created_at: string
          generated_by: string | null
          id: string
          investigation_id: string
          org_id: string
          share_token: string | null
          status: Database["public"]["Enums"]["report_status"]
          template: Database["public"]["Enums"]["report_template"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          investigation_id: string
          org_id: string
          share_token?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          template?: Database["public"]["Enums"]["report_template"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          investigation_id?: string
          org_id?: string
          share_token?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          template?: Database["public"]["Enums"]["report_template"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          id: string
          investigation_id: string
          org_id: string
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          id?: string
          investigation_id: string
          org_id: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          id?: string
          investigation_id?: string
          org_id?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scoring_rules: {
        Row: {
          created_at: string
          description: string | null
          factor: string
          id: string
          is_active: boolean
          org_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          factor: string
          id?: string
          is_active?: boolean
          org_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          factor?: string
          id?: string
          is_active?: boolean
          org_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_scoring_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_hits: {
        Row: {
          created_at: string
          data: Json
          disposition: string
          id: string
          is_confirmed: boolean | null
          match_score: number
          matched_name: string | null
          result_id: string
          review_rationale: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          disposition?: string
          id?: string
          is_confirmed?: boolean | null
          match_score: number
          matched_name?: string | null
          result_id: string
          review_rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          disposition?: string
          id?: string
          is_confirmed?: boolean | null
          match_score?: number
          matched_name?: string | null
          result_id?: string
          review_rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_hits_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "screening_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_hits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_results: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          hit_count: number
          id: string
          investigation_id: string
          raw_data: Json
          started_at: string | null
          status: Database["public"]["Enums"]["screening_status"]
          type: Database["public"]["Enums"]["screening_type"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          hit_count?: number
          id?: string
          investigation_id: string
          raw_data?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["screening_status"]
          type: Database["public"]["Enums"]["screening_type"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          hit_count?: number
          id?: string
          investigation_id?: string
          raw_data?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["screening_status"]
          type?: Database["public"]["Enums"]["screening_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_results_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          org_id: string
          raw_content: Json
          retrieved_at: string
          source_name: string
          source_type: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          org_id: string
          raw_content?: Json
          retrieved_at?: string
          source_name: string
          source_type: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          org_id?: string
          raw_content?: Json
          retrieved_at?: string
          source_name?: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          description: string | null
          event_type: string
          id: string
          investigation_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          event_type: string
          id?: string
          investigation_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          event_type?: string
          id?: string
          investigation_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          last_read_at: string | null
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          last_read_at?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_read_at?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_investigation_risk_score: {
        Args: { investigation_uuid: string }
        Returns: number
      }
      get_org_id_for_user: { Args: { user_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      entity_type: "individual" | "company" | "trust" | "partnership" | "other"
      investigation_status:
        | "active"
        | "pending_review"
        | "completed"
        | "escalated"
        | "archived"
      link_type:
        | "ownership"
        | "control"
        | "nominee"
        | "beneficial_owner"
        | "other"
      report_status: "draft" | "in_review" | "final" | "archived"
      report_template:
        | "standard_dd"
        | "enhanced_dd"
        | "sanctions_alert"
        | "periodic_review"
      screening_status: "pending" | "running" | "completed" | "failed"
      screening_type: "sanctions" | "pep" | "adverse_media" | "registry"
      user_role: "owner" | "admin" | "compliance_manager" | "analyst" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entity_type: ["individual", "company", "trust", "partnership", "other"],
      investigation_status: [
        "active",
        "pending_review",
        "completed",
        "escalated",
        "archived",
      ],
      link_type: [
        "ownership",
        "control",
        "nominee",
        "beneficial_owner",
        "other",
      ],
      report_status: ["draft", "in_review", "final", "archived"],
      report_template: [
        "standard_dd",
        "enhanced_dd",
        "sanctions_alert",
        "periodic_review",
      ],
      screening_status: ["pending", "running", "completed", "failed"],
      screening_type: ["sanctions", "pep", "adverse_media", "registry"],
      user_role: ["owner", "admin", "compliance_manager", "analyst", "viewer"],
    },
  },
} as const

export type UserRole = Enums<'user_role'>
export type ReportTemplate = Enums<'report_template'>
export type ReportStatus = Enums<'report_status'>
