export type Role = 'user' | 'lead' | 'technician';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type TicketCategory = 'laptop' | 'connectivity' | 'printer' | 'software' | 'desktop' | 'other';
export type TicketStatus = 'open' | 'assigned' | 'completed' | 'acknowledged';
export type TicketPriority = 'low' | 'medium' | 'high';

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
  status: 'active' | 'inactive' | 'on-leave';
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  message: string;
  ticket_id: string;
  is_read: number;
  created_at: string;
}
