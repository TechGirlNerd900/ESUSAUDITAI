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
      users: {
        Row: {
          id: string
          auth_user_id: string
          email: string
          first_name: string
          last_name: string
          role: 'admin' | 'auditor' | 'reviewer'
          company: string | null
          status: 'active' | 'inactive'
          is_active: boolean
          created_at: string
          updated_at: string
          last_login_at: string | null
          last_activity_at: string | null
          failed_login_attempts: number
          locked_until: string | null
          password_changed_at: string | null
        }
        Insert: {
          id?: string
          auth_user_id: string
          email: string
          first_name: string
          last_name: string
          role?: 'admin' | 'auditor' | 'reviewer'
          company?: string | null
          status?: 'active' | 'inactive'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          last_activity_at?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          password_changed_at?: string | null
        }
        Update: {
          id?: string
          auth_user_id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'admin' | 'auditor' | 'reviewer'
          company?: string | null
          status?: 'active' | 'inactive'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          last_activity_at?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          password_changed_at?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          client_name: string | null
          client_email: string | null
          audit_type: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status: 'active' | 'completed' | 'archived' | 'draft'
          created_by: string
          assigned_to: string[]
          start_date: string | null
          end_date: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          client_name?: string | null
          client_email?: string | null
          audit_type: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status?: 'active' | 'completed' | 'archived' | 'draft'
          created_by: string
          assigned_to?: string[]
          start_date?: string | null
          end_date?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          client_name?: string | null
          client_email?: string | null
          audit_type?: 'financial' | 'compliance' | 'security' | 'operational' | 'custom'
          status?: 'active' | 'completed' | 'archived' | 'draft'
          created_by?: string
          assigned_to?: string[]
          start_date?: string | null
          end_date?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          project_id: string
          uploaded_by: string
          name: string
          original_name: string
          file_path: string
          file_size: number
          file_type: string
          blob_url: string
          status: 'uploaded' | 'processing' | 'analyzed' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          uploaded_by: string
          name: string
          original_name: string
          file_path: string
          file_size: number
          file_type: string
          blob_url: string
          status?: 'uploaded' | 'processing' | 'analyzed' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          uploaded_by?: string
          name?: string
          original_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          blob_url?: string
          status?: 'uploaded' | 'processing' | 'analyzed' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      analysis_results: {
        Row: {
          id: string
          document_id: string
          extracted_data: Json
          ai_summary: string
          red_flags: string[]
          highlights: string[]
          confidence_score: number
          processing_time_ms: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          extracted_data: Json
          ai_summary: string
          red_flags?: string[]
          highlights?: string[]
          confidence_score: number
          processing_time_ms: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          extracted_data?: Json
          ai_summary?: string
          red_flags?: string[]
          highlights?: string[]
          confidence_score?: number
          processing_time_ms?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_history: {
        Row: {
          id: string
          project_id: string
          user_id: string
          question: string
          answer: string
          context_documents: string[]
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          question: string
          answer: string
          context_documents?: string[]
          created_at?: string
        }
        Update: {
          id?: string
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
          project_id: string
          generated_by: string
          report_name: string
          report_data: Json
          pdf_url: string
          status: 'draft' | 'final' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          generated_by: string
          report_name: string
          report_data: Json
          pdf_url: string
          status?: 'draft' | 'final' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          generated_by?: string
          report_name?: string
          report_data?: Json
          pdf_url?: string
          status?: 'draft' | 'final' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          resource_type: string
          resource_id: string | null
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          resource_type: string
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          resource_type?: string
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          category: string | null
          is_sensitive: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          category?: string | null
          is_sensitive?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
          category?: string | null
          is_sensitive?: boolean
          created_at?: string
          updated_at?: string
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