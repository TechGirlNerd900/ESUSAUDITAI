export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          parent_organization_id: string | null
          hierarchy_path: string[]
          settings: Json
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_organization_id?: string | null
          hierarchy_path?: string[]
          settings?: Json
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_organization_id?: string | null
          hierarchy_path?: string[]
          settings?: Json
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          organization_id: string
          auth_user_id: string
          email: string
          first_name: string
          last_name: string
          role: 'admin' | 'auditor' | 'reviewer'
          company: string | null
          status: 'active' | 'inactive' | 'suspended'
          is_active: boolean
          created_at: string
          updated_at: string
          last_login_at: string | null
          last_activity_at: string | null
          failed_login_attempts: number
          locked_until: string | null
          password_changed_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          auth_user_id: string
          email: string
          first_name: string
          last_name: string
          role?: 'admin' | 'auditor' | 'reviewer'
          company?: string | null
          status?: 'active' | 'inactive' | 'suspended'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          last_activity_at?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          password_changed_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          auth_user_id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'admin' | 'auditor' | 'reviewer'
          company?: string | null
          status?: 'active' | 'inactive' | 'suspended'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          last_activity_at?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          password_changed_at?: string | null
          deleted_at?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          client_name: string | null
          client_email: string | null
          audit_type: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status: 'active' | 'completed' | 'archived' | 'draft'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          created_by: string
          assigned_to: string[]
          start_date: string | null
          end_date: string | null
          due_date: string | null
          budget: number | null
          estimated_hours: number | null
          actual_hours: number | null
          compliance_framework: string | null
          risk_level: 'low' | 'medium' | 'high' | 'critical'
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          client_name?: string | null
          client_email?: string | null
          audit_type: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status?: 'active' | 'completed' | 'archived' | 'draft'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          created_by: string
          assigned_to?: string[]
          start_date?: string | null
          end_date?: string | null
          due_date?: string | null
          budget?: number | null
          estimated_hours?: number | null
          actual_hours?: number | null
          compliance_framework?: string | null
          risk_level?: 'low' | 'medium' | 'high' | 'critical'
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          client_name?: string | null
          client_email?: string | null
          audit_type?: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status?: 'active' | 'completed' | 'archived' | 'draft'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          created_by?: string
          assigned_to?: string[]
          start_date?: string | null
          end_date?: string | null
          due_date?: string | null
          budget?: number | null
          estimated_hours?: number | null
          actual_hours?: number | null
          compliance_framework?: string | null
          risk_level?: 'low' | 'medium' | 'high' | 'critical'
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          uploaded_by: string
          name: string
          original_name: string
          file_path: string
          file_size: number
          file_type: string
          file_hash: string | null
          blob_url: string
          status: 'uploaded' | 'processing' | 'analyzed' | 'error'
          classification: 'public' | 'internal' | 'confidential' | 'restricted'
          sensitivity_level: 'low' | 'medium' | 'high' | 'critical'
          access_level: 'public' | 'internal' | 'confidential' | 'restricted'
          retention_date: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          uploaded_by: string
          name: string
          original_name: string
          file_path: string
          file_size: number
          file_type: string
          file_hash?: string | null
          blob_url: string
          status?: 'uploaded' | 'processing' | 'analyzed' | 'error'
          classification?: 'public' | 'internal' | 'confidential' | 'restricted'
          sensitivity_level?: 'low' | 'medium' | 'high' | 'critical'
          access_level?: 'public' | 'internal' | 'confidential' | 'restricted'
          retention_date?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          uploaded_by?: string
          name?: string
          original_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          file_hash?: string | null
          blob_url?: string
          status?: 'uploaded' | 'processing' | 'analyzed' | 'error'
          classification?: 'public' | 'internal' | 'confidential' | 'restricted'
          sensitivity_level?: 'low' | 'medium' | 'high' | 'critical'
          access_level?: 'public' | 'internal' | 'confidential' | 'restricted'
          retention_date?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      analysis_results: {
        Row: {
          id: string
          organization_id: string
          document_id: string
          extracted_data: Json
          ai_summary: string
          red_flags: string[]
          highlights: string[]
          confidence_score: number
          processing_time_ms: number
          analysis_type: string
          model_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          document_id: string
          extracted_data: Json
          ai_summary: string
          red_flags?: string[]
          highlights?: string[]
          confidence_score: number
          processing_time_ms: number
          analysis_type: string
          model_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          document_id?: string
          extracted_data?: Json
          ai_summary?: string
          red_flags?: string[]
          highlights?: string[]
          confidence_score?: number
          processing_time_ms?: number
          analysis_type?: string
          model_version?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          first_name: string
          last_name: string
          role: 'auditor' | 'reviewer'
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by: string
          invited_at: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoke_reason: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          first_name: string
          last_name: string
          role: 'auditor' | 'reviewer'
          token: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by: string
          invited_at?: string
          expires_at: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoke_reason?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'auditor' | 'reviewer'
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by?: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoke_reason?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_history: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          user_id: string
          question: string
          answer: string
          context_documents: string[]
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          user_id: string
          question: string
          answer: string
          context_documents?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          user_id?: string
          question?: string
          answer?: string
          context_documents?: string[]
          created_at?: string
        }
      }
      audit_reports: {
        Row: {
          id: string
          organization_id: string
          project_id: string
          title: string
          description: string | null
          report_type: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          report_format: 'pdf' | 'html' | 'docx' | 'xlsx'
          template_id: string | null
          report_data: Json
          executive_summary: string | null
          findings: Json
          recommendations: Json
          conclusions: string | null
          status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
          version_number: number
          parent_report_id: string | null
          created_by: string
          reviewed_by: string | null
          approved_by: string | null
          published_by: string | null
          file_path: string | null
          file_size: number | null
          file_hash: string | null
          access_level: 'public' | 'internal' | 'confidential' | 'restricted'
          share_with_client: boolean
          client_accessible: boolean
          password_protected: boolean
          report_period_start: string | null
          report_period_end: string | null
          generated_at: string | null
          reviewed_at: string | null
          approved_at: string | null
          published_at: string | null
          expires_at: string | null
          distribution_list: Json
          external_recipients: Json
          custom_fields: Json
          tags: string[]
          archived_at: string | null
          archived_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          project_id: string
          title: string
          description?: string | null
          report_type?: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          report_format?: 'pdf' | 'html' | 'docx' | 'xlsx'
          template_id?: string | null
          report_data: Json
          executive_summary?: string | null
          findings?: Json
          recommendations?: Json
          conclusions?: string | null
          status?: 'draft' | 'review' | 'approved' | 'published' | 'archived'
          version_number?: number
          parent_report_id?: string | null
          created_by: string
          reviewed_by?: string | null
          approved_by?: string | null
          published_by?: string | null
          file_path?: string | null
          file_size?: number | null
          file_hash?: string | null
          access_level?: 'public' | 'internal' | 'confidential' | 'restricted'
          share_with_client?: boolean
          client_accessible?: boolean
          password_protected?: boolean
          report_period_start?: string | null
          report_period_end?: string | null
          generated_at?: string | null
          reviewed_at?: string | null
          approved_at?: string | null
          published_at?: string | null
          expires_at?: string | null
          distribution_list?: Json
          external_recipients?: Json
          custom_fields?: Json
          tags?: string[]
          archived_at?: string | null
          archived_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          project_id?: string
          title?: string
          description?: string | null
          report_type?: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          report_format?: 'pdf' | 'html' | 'docx' | 'xlsx'
          template_id?: string | null
          report_data?: Json
          executive_summary?: string | null
          findings?: Json
          recommendations?: Json
          conclusions?: string | null
          status?: 'draft' | 'review' | 'approved' | 'published' | 'archived'
          version_number?: number
          parent_report_id?: string | null
          created_by?: string
          reviewed_by?: string | null
          approved_by?: string | null
          published_by?: string | null
          file_path?: string | null
          file_size?: number | null
          file_hash?: string | null
          access_level?: 'public' | 'internal' | 'confidential' | 'restricted'
          share_with_client?: boolean
          client_accessible?: boolean
          password_protected?: boolean
          report_period_start?: string | null
          report_period_end?: string | null
          generated_at?: string | null
          reviewed_at?: string | null
          approved_at?: string | null
          published_at?: string | null
          expires_at?: string | null
          distribution_list?: Json
          external_recipients?: Json
          custom_fields?: Json
          tags?: string[]
          archived_at?: string | null
          archived_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          session_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          referer: string | null
          request_id: string | null
          severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          status: 'success' | 'failure' | 'pending'
          error_message: string | null
          duration_ms: number | null
          created_at: string
          partition_date: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          session_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          referer?: string | null
          request_id?: string | null
          severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          status?: 'success' | 'failure' | 'pending'
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          session_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          referer?: string | null
          request_id?: string | null
          severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          status?: 'success' | 'failure' | 'pending'
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          category: string
          is_sensitive: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          category?: string
          is_sensitive?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          description?: string | null
          category?: string
          is_sensitive?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      report_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          template_type: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          category: string | null
          schema_definition: Json
          default_content: Json
          required_fields: string[]
          optional_fields: string[]
          styling_config: Json
          is_active: boolean
          is_default: boolean
          version: number
          created_by: string
          last_modified_by: string | null
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          template_type: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          category?: string | null
          schema_definition: Json
          default_content?: Json
          required_fields?: string[]
          optional_fields?: string[]
          styling_config?: Json
          is_active?: boolean
          is_default?: boolean
          version?: number
          created_by: string
          last_modified_by?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          template_type?: 'audit' | 'compliance' | 'risk_assessment' | 'summary' | 'detailed' | 'executive'
          category?: string | null
          schema_definition?: Json
          default_content?: Json
          required_fields?: string[]
          optional_fields?: string[]
          styling_config?: Json
          is_active?: boolean
          is_default?: boolean
          version?: number
          created_by?: string
          last_modified_by?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      security_events: {
        Row: {
          id: string
          organization_id: string
          event_type: string
          severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          source: string
          user_id: string | null
          session_id: string | null
          ip_address: string | null
          user_agent: string | null
          event_data: Json
          description: string
          risk_score: number | null
          is_resolved: boolean
          resolved_by: string | null
          resolved_at: string | null
          resolution_notes: string | null
          mitigation_actions: Json
          false_positive: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          event_type: string
          severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          source: string
          user_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_data?: Json
          description: string
          risk_score?: number | null
          is_resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          mitigation_actions?: Json
          false_positive?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          event_type?: string
          severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          source?: string
          user_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_data?: Json
          description?: string
          risk_score?: number | null
          is_resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          mitigation_actions?: Json
          false_positive?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      login_attempts: {
        Row: {
          id: string
          organization_id: string | null
          email: string
          user_id: string | null
          ip_address: string
          user_agent: string | null
          success: boolean
          failure_reason: string | null
          mfa_used: boolean
          mfa_method: string | null
          location_country: string | null
          location_city: string | null
          device_fingerprint: string | null
          session_id: string | null
          blocked: boolean
          block_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          email: string
          user_id?: string | null
          ip_address: string
          user_agent?: string | null
          success: boolean
          failure_reason?: string | null
          mfa_used?: boolean
          mfa_method?: string | null
          location_country?: string | null
          location_city?: string | null
          device_fingerprint?: string | null
          session_id?: string | null
          blocked?: boolean
          block_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          email?: string
          user_id?: string | null
          ip_address?: string
          user_agent?: string | null
          success?: boolean
          failure_reason?: string | null
          mfa_used?: boolean
          mfa_method?: string | null
          location_country?: string | null
          location_city?: string | null
          device_fingerprint?: string | null
          session_id?: string | null
          blocked?: boolean
          block_reason?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export interface Project {
  id: string
  name: string
  description: string | null
  user_id: string
  created_at: string
  updated_at: string
  status: string
  client_name?: string
  client_email?: string
  audit_type: string
  due_date?: string
  assigned_to: string[]
}

export interface Document {
  id: string
  name: string
  file_path: string
  project_id: string
  status: string
  created_by: string
  created_at: string
  analyzed_at?: string
  file_type: string
  file_size: number
  public_url: string
  analysis_results?: any
}

export interface ChatMessage {
  id: string
  project_id: string
  user_id?: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  organization?: string
  role: string
  status: string
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}