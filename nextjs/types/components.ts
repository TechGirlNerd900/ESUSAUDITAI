/**
 * Comprehensive Component Type Definitions
 * Phase 2.1 - Type System Foundation
 */

// ===== USER & AUTHENTICATION TYPES =====
export interface User {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'auditor' | 'reviewer';
  organization_id: string;
  status: 'active' | 'inactive' | 'suspended';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== PROJECT TYPES =====
export interface Project {
  id: string;
  name: string;
  description?: string;
  client_name: string;
  client_email?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  created_by: string;
  organization_id: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  client_name: string;
  client_email?: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

// ===== DOCUMENT TYPES =====
export interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  project_id: string;
  uploaded_by: string;
  organization_id: string;
  is_analyzed: boolean;
  analysis_results?: any;
  metadata?: Record<string, any>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ===== CHAT & MESSAGING TYPES =====
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  citations?: SearchResultItem[];
}

export interface SearchResultItem {
  textContent: string;
  sourceDocument: string;
}

// ===== ORGANIZATION TYPES =====
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ===== AUDIT & REPORTING TYPES =====
export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  organization_id: string;
  created_at: string;
}

export interface AuditReport {
  id: string;
  report_name: string;
  project_id: string;
  status: 'draft' | 'final' | 'archived';
  created_by: string;
  organization_id: string;
  content?: any;
  created_at: string;
  updated_at: string;
}

// ===== COMPONENT PROP TYPES =====
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  cursor?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number | null;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ===== FORM TYPES =====
export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ===== DASHBOARD TYPES =====
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalDocuments: number;
  pendingReviews: number;
  recentActivity: number;
}

// ===== FILTER TYPES =====
export interface ProjectFilters {
  status?: Project['status'];
  search?: string;
  assignedTo?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface DocumentFilters {
  projectId?: string;
  fileType?: string;
  isAnalyzed?: boolean;
  search?: string;
  status?: 'draft' | 'review' | 'approved' | 'rejected';
  type?: 'financial' | 'compliance' | 'tax' | 'audit' | 'other';
  searchTerm?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ===== EVENT HANDLER TYPES =====
export interface EventHandlers {
  onClick?: (event: React.MouseEvent) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit?: (event: React.FormEvent) => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
}

// ===== TASK & WORKFLOW TYPES =====
export interface TaskOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'success' | 'warning';
  requiredRole?: User['role'][];
  action?: string;
}

// ===== UTILITY TYPES =====
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;