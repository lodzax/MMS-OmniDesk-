export type Role = 'end_user' | 'technician' | 'it_lead' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
}

export type TicketCategory = 'laptop' | 'connectivity' | 'printer' | 'software' | 'desktop' | 'other';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'acknowledged';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string;
  requested_for: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  creator_name: string;
  requester_name: string;
  technician_name: string | null;
  is_escalated: boolean;
  escalation_reason?: string | null;
  is_blocked?: boolean;
  sla_target_time: string | null;
  sla_status: 'on_track' | 'approaching' | 'breached' | 'resolved';
  tags: string[];
  rating?: number | null;
  resolved_at?: string | null;
}

export interface Activity {
  id: number;
  ticket_id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
  user_name: string;
  user_role: Role;
}

export interface Technician {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  created_at: string;
  kpis?: {
    resolved_count: number;
    avg_resolution_time: number;
    sla_compliance: number;
    avg_rating: number;
  };
}

export interface Notification {
  id: number;
  user_id: string;
  message: string;
  ticket_id: string;
  is_read: number;
  created_at: string;
}

export interface Dependency {
  id: number;
  depends_on_id: string;
  ticket?: Partial<Ticket>;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: TicketCategory | 'general';
  tags: string[];
  created_at: string;
  updated_at: string;
}
