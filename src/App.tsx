import React, { useState, useEffect, useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { TechnicianManagement } from './components/TechnicianManagement';
import { UserManagement } from './components/UserManagement';
import { UserProfile } from './components/UserProfile';
import { AccountSettings } from './components/AccountSettings';
import { Modal } from './components/Modal';
import { SettingsModal } from './components/SettingsModal';
import { 
  Ticket as TicketIcon, 
  Plus, 
  User as UserIcon, 
  Settings, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  MessageSquare, 
  History,
  Laptop,
  Monitor,
  HelpCircle,
  Wifi,
  Printer,
  Code2,
  Filter,
  LogOut,
  ShieldCheck,
  Bell,
  X,
  Search,
  Edit,
  LayoutDashboard,
  Trash2,
  Check,
  List,
  Loader2,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { User, Ticket, Activity, Role, TicketCategory, TicketStatus, TicketPriority, Notification } from './types';

const CATEGORIES: { id: TicketCategory; label: string; icon: any }[] = [
  { id: 'laptop', label: 'Laptop', icon: Laptop },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'connectivity', label: 'Connectivity', icon: Wifi },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'software', label: 'Software', icon: Code2 },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'laptop' as TicketCategory, priority: 'medium' as TicketPriority, requested_for: '' });
  const [newTicket, setNewTicket] = useState({ title: '', description: '', category: 'laptop' as TicketCategory, priority: 'medium' as TicketPriority, requested_for: '' });
  const [workLog, setWorkLog] = useState('');
  const [comment, setComment] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'dashboard' | 'technicians' | 'users' | 'profile' | 'account-settings'>('profile');
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  useEffect(() => {
    // Explicitly remove dark mode classes and clear theme from localStorage
    const root = window.document.documentElement;
    const body = window.document.body;
    root.classList.remove('dark');
    body.classList.remove('dark');
    root.style.colorScheme = 'light';
    localStorage.removeItem('theme');
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });

  const filteredTickets = useMemo(() => {
    if (!currentUser) return [];
    const filtered = tickets.filter(t => {
      // Role-based visibility
      const isCreator = t.created_by === currentUser.id;
      const isRequester = t.requested_for === currentUser.id;
      const isAssigned = t.assigned_to === currentUser.id;

      // Role-based visibility: IT Leads and Technicians see all tickets.
      // Regular users only see tickets they created or were requested for.
      let hasAccess = false;
      if (currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') {
        hasAccess = true;
      } else {
        hasAccess = isCreator || isRequester;
      }

      if (!hasAccess) return false;

      // Search and filters
      const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });

    // Sort by priority (descending) then by date (descending)
    return [...filtered].sort((a, b) => {
      const priorityDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets, currentUser, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setIsAuthLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setIsAuthLoading(false);
      }
    });

    fetchUsers();
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('Received HTML instead of JSON:', text.substring(0, 200));
        throw new Error('Server returned HTML instead of JSON. This usually means the API route is missing and falling back to index.html.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile');
      }
      const data = await response.json();
      if (data) {
        setCurrentUser(data);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      // Only show alert if it's not a background refresh
      if (err.message !== 'Failed to fetch profile') {
        alert(`Error fetching profile: ${err.message}`);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTickets();
      fetchNotifications(currentUser.id);
      
      // WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', userId: currentUser.id }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.data, ...prev]);
          // Optional: Show a toast or sound
        }
      };
      
      return () => ws.close();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedTicket) {
      fetchActivities(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTickets = async () => {
    if (!currentUser) return;
    setIsLoadingTickets(true);
    try {
      const response = await fetch('/api/tickets');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
      }
      const data = await response.json();
      setTickets(data);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      // Don't show alert for background fetches to avoid spamming
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchActivities = async (ticketId: string) => {
    setIsLoadingActivities(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/activities`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
      }
      const data = await response.json();
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Ticket Submission',
      message: `Please confirm your ticket details:\n\nTitle: ${newTicket.title}\nCategory: ${newTicket.category}\nPriority: ${newTicket.priority}\n\nDescription: ${newTicket.description.substring(0, 100)}${newTicket.description.length > 100 ? '...' : ''}`,
      type: 'info',
      confirmText: 'Submit Ticket',
      onConfirm: async () => {
        const id = Math.random().toString(36).substr(2, 9);
        const requesterId = newTicket.requested_for || currentUser.id;
        
        try {
          const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              title: newTicket.title,
              description: newTicket.description,
              category: newTicket.category,
              priority: newTicket.priority,
              created_by: currentUser.id,
              requested_for: requesterId
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to create ticket');
            throw new Error(errorMsg);
          }

          setIsCreating(false);
          setNewTicket({ title: '', description: '', category: 'laptop', priority: 'medium', requested_for: '' });
          fetchTickets();
        } catch (err: any) {
          console.error('Error creating ticket:', err);
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  const handleAssign = async (ticketId: string, technicianId: string) => {
    if (!currentUser) return;
    console.log(`Frontend: Assigning ticket ${ticketId} to technician ${technicianId}`);

    const tech = users.find(u => u.id === technicianId);
    if (!tech) {
      console.error(`Technician with ID ${technicianId} not found in users list.`);
    }
    
    const isReassignment = !!selectedTicket?.assigned_to;
    
    setConfirmModal({
      isOpen: true,
      title: isReassignment ? 'Confirm Re-assignment' : 'Confirm Assignment',
      message: `Are you sure you want to ${isReassignment ? 're-assign' : 'assign'} this ticket to ${tech?.name}? They will be notified immediately.`,
      type: 'info',
      confirmText: isReassignment ? 'Re-assign Ticket' : 'Assign Ticket',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technician_id: technicianId,
              user_id: currentUser.id
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to assign ticket');
            throw new Error(errorMsg);
          }

          fetchTickets();
          if (selectedTicket?.id === ticketId) {
            setSelectedTicket(prev => prev ? { 
              ...prev, 
              status: 'assigned', 
              assigned_to: technicianId,
              technician_name: tech?.name || null 
            } : null);
          }
        } catch (err: any) {
          console.error('Error assigning ticket:', err);
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  const handleLogWork = async (ticketId: string) => {
    if (!currentUser || !workLog.trim()) return;
    
    try {
      const response = await fetch(`/api/tickets/${ticketId}/work`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: currentUser.id,
          work_done: workLog.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to log work');
        throw new Error(errorMsg);
      }
      
      setWorkLog('');
      fetchActivities(ticketId);
    } catch (err: any) {
      console.error('Error logging work:', err);
      alert(`Error logging work: ${err.message}`);
    }
  };

  const handleBulkStatusUpdate = async (status: TicketStatus) => {
    if (!currentUser || selectedTicketIds.length === 0) return;
    try {
      const response = await fetch('/api/tickets/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketIds: selectedTicketIds,
          status,
          user_id: currentUser.id
        })
      });
      if (!response.ok) throw new Error('Bulk update failed');
      await fetchTickets();
      setSelectedTicketIds([]);
    } catch (err) {
      console.error('Bulk update error:', err);
      alert('Failed to update tickets');
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser || selectedTicketIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedTicketIds.length} tickets?`)) return;
    
    try {
      const response = await fetch('/api/tickets/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketIds: selectedTicketIds,
          user_id: currentUser.id
        })
      });
      if (!response.ok) throw new Error('Bulk delete failed');
      await fetchTickets();
      setSelectedTicketIds([]);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to delete tickets');
    }
  };

  const handleComplete = async (ticketId: string) => {
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: 'Mark as Complete',
      message: 'Are you sure this issue has been fully resolved? This will notify the creator to acknowledge the fix.',
      type: 'warning',
      confirmText: 'Mark Complete',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/tickets/${ticketId}/complete`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technician_id: currentUser.id
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to complete ticket');
            throw new Error(errorMsg);
          }

          fetchTickets();
          if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, status: 'completed' } : null);
        } catch (err: any) {
          console.error('Error completing ticket:', err);
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  const handleAcknowledge = async (ticketId: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to acknowledge ticket');
        throw new Error(errorMsg);
      }

      fetchTickets();
      if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, status: 'acknowledged' } : null);
    } catch (err: any) {
      console.error('Error acknowledging ticket:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleStatusUpdate = async (ticketId: string, newStatus: TicketStatus) => {
    if (!currentUser) return;
    
    try {
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          user_id: currentUser.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to update status');
        throw new Error(errorMsg);
      }

      fetchTickets();
      fetchActivities(ticketId);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleEscalate = async (ticketId: string) => {
    if (!currentUser) return;
    
    const reason = prompt("Please provide a reason for escalation (optional):") || "Unresolved for too long";
    
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Escalation',
      message: 'Are you sure you want to escalate this ticket? IT Leads will be notified immediately.',
      type: 'warning',
      confirmText: 'Escalate Ticket',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/tickets/${ticketId}/escalate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser.id,
              reason
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to escalate ticket');
          }

          fetchTickets();
          fetchActivities(ticketId);
          if (selectedTicket?.id === ticketId) {
            setSelectedTicket(prev => prev ? { ...prev, is_escalated: true, priority: 'critical' } : null);
          }
        } catch (err: any) {
          console.error('Error escalating ticket:', err);
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  const canEscalate = (ticket: Ticket) => {
    if (!currentUser) return false;
    if (ticket.is_escalated) return false;
    if (ticket.status === 'completed' || ticket.status === 'acknowledged') return false;
    
    if (currentUser.role === 'it_lead' || currentUser.role === 'admin') return true;
    
    const createdDate = new Date(ticket.created_at);
    const now = new Date();
    const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    
    return diffHours >= 24;
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTicket) return;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          user_id: currentUser.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to update ticket');
        throw new Error(errorMsg);
      }

      setIsEditingDetail(false);
      fetchTickets();
      fetchActivities(selectedTicket.id);
      setSelectedTicket(prev => prev ? { ...prev, ...editForm } : null);
    } catch (err: any) {
      console.error('Error updating ticket:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTicket || !comment.trim()) return;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          comment: comment.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to add comment');
        throw new Error(errorMsg);
      }

      setComment('');
      fetchActivities(selectedTicket.id);
    } catch (err: any) {
      console.error('Error adding comment:', err);
      alert(`Error adding comment: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'assigned': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'acknowledged': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
      case 'high': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('list');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] dark:bg-[#000000]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onAuthSuccess={(user) => {
      setCurrentUser(user);
      setView('list');
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans transition-colors duration-300">
      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedTicketIds.length > 0 && (currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 flex items-center gap-6 z-50 min-w-[400px]"
          >
            <div className="flex items-center gap-3 border-r border-gray-100 dark:border-gray-800 pr-6">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                {selectedTicketIds.length}
              </div>
              <div>
                <p className="text-sm font-bold dark:text-white">Tickets Selected</p>
                <button 
                  onClick={() => setSelectedTicketIds([])}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status:</span>
              <button 
                onClick={() => handleBulkStatusUpdate('completed')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold hover:bg-green-100 transition-colors dark:bg-green-900/20 dark:text-green-400"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete
              </button>
              <button 
                onClick={() => handleBulkStatusUpdate('assigned')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:text-blue-400"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Assign
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors dark:bg-rose-900/20 dark:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <TicketIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">OmniDesk</h1>
          </div>

          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <button 
                  onClick={() => setView('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  Tickets
                </button>
                {currentUser.role !== 'end_user' && (
                  <button 
                    onClick={() => setView('dashboard')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Dashboard
                  </button>
                )}
                {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
                  <button 
                    onClick={() => setView('technicians')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'technicians' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Technicians
                  </button>
                )}
                {(currentUser.role === 'it_lead' || currentUser.role === 'admin') && (
                  <button 
                    onClick={() => setView('users')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'users' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Users
                  </button>
                )}
              </div>
            )}
            
            {/* Settings Button */}
            <button 
              onClick={() => setView('profile')}
              className={`p-2 rounded-full transition-colors ${view === 'profile' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              title="Profile"
            >
              <UserIcon className="w-5 h-5" />
            </button>

            {(currentUser.role === 'it_lead' || currentUser.role === 'admin') && (
              <button 
                onClick={() => setView('account-settings')}
                className={`p-2 rounded-full transition-colors ${view === 'account-settings' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'hover:bg-gray-100 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                title="Account Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <h3 className="font-bold text-sm">Notifications</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              markAsRead(n.id);
                              const ticket = tickets.find(t => t.id === n.ticket_id);
                              if (ticket) {
                                setSelectedTicket(ticket);
                                setIsEditingDetail(false);
                              }
                              setShowNotifications(false);
                            }}
                            className={`p-4 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                <TicketIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <p className={`text-xs leading-relaxed ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                  {n.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/40">
                <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium leading-none dark:text-gray-200">{currentUser.name}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold dark:text-gray-500">{currentUser.role.replace('_', ' ')}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'profile' ? (
          <UserProfile user={currentUser} onUpdate={(updated) => setCurrentUser(updated)} onBack={() => setView('list')} />
        ) : view === 'account-settings' && (currentUser.role === 'it_lead' || currentUser.role === 'admin') ? (
          <AccountSettings currentUser={currentUser} />
        ) : view === 'technicians' && (currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') ? (
          <TechnicianManagement users={users} currentUser={currentUser} />
        ) : view === 'users' && (currentUser.role === 'it_lead' || currentUser.role === 'admin') ? (
          <UserManagement currentUser={currentUser} />
        ) : view === 'dashboard' && currentUser.role !== 'end_user' ? (
          <Dashboard 
            tickets={tickets} 
            onFilterStatus={setStatusFilter}
            onFilterPriority={setPriorityFilter}
            onFilterCategory={setCategoryFilter}
            onViewList={() => setView('list')}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar / List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold dark:text-white">Tickets</h2>
                {(statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || searchTerm !== '') && (
                  <button 
                    onClick={() => {
                      setStatusFilter('all');
                      setPriorityFilter('all');
                      setCategoryFilter('all');
                      setSearchTerm('');
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md dark:bg-indigo-900/20 dark:text-indigo-400"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button 
                onClick={() => {
                  setIsCreating(true);
                  setIsEditingDetail(false);
                }}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm dark:shadow-none"
              >
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            </div>

            {/* Search and Filter Dropdowns */}
            <div className="space-y-2">
              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <Search className="w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search tickets..."
                  className="flex-1 text-sm bg-white border-none focus:ring-0 outline-none font-medium text-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white border-none focus:ring-0 cursor-pointer font-medium text-black"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="completed">Completed</option>
                  <option value="acknowledged">Acknowledged</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white border-none focus:ring-0 cursor-pointer font-medium text-black"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical Priority</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <Laptop className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white border-none focus:ring-0 cursor-pointer font-medium text-black"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredTickets.length > 0 && (currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
              <div className="flex items-center gap-2 px-1 py-1">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                  checked={selectedTicketIds.length === filteredTickets.length && filteredTickets.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTicketIds(filteredTickets.map(t => t.id));
                    } else {
                      setSelectedTicketIds([]);
                    }
                  }}
                />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Select All</span>
              </div>
            )}

            <div className="space-y-3">
              {isLoadingTickets ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-100 dark:bg-[#1C1C1E] dark:border-gray-800">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                  <p className="text-sm text-gray-500 font-medium dark:text-gray-400">Loading tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 dark:bg-[#1C1C1E] dark:border-gray-800 dark:border-gray-700">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tickets found</p>
                </div>
              ) : (
                filteredTickets.map(ticket => (
                  <motion.div 
                    layoutId={ticket.id}
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setIsEditingDetail(false);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-indigo-50/50 border-indigo-600 shadow-md ring-1 ring-indigo-600 dark:bg-indigo-900/10 dark:border-indigo-500 dark:ring-indigo-500' 
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800 dark:hover:border-indigo-700'
                    }`}
                  >
                    {selectedTicket?.id === ticket.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 dark:bg-indigo-500" />
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                            checked={selectedTicketIds.includes(ticket.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTicketIds(prev => [...prev, ticket.id]);
                              } else {
                                setSelectedTicketIds(prev => prev.filter(id => id !== ticket.id));
                              }
                            }}
                          />
                        )}
                        <div className="flex gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          {ticket.is_escalated && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-red-600 bg-red-600 text-white flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Escalated
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono dark:text-gray-500">#{ticket.id}</span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-indigo-600 transition-colors dark:text-gray-200 dark:group-hover:text-indigo-400">
                      {ticket.title}
                      {ticket.requested_for !== ticket.created_by && (
                        <span className="text-[10px] text-gray-400 ml-2 font-normal dark:text-gray-500">for {ticket.requester_name}</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        {CATEGORIES.find(c => c.id === ticket.category)?.icon && React.createElement(CATEGORIES.find(c => c.id === ticket.category)!.icon, { className: "w-3 h-3" })}
                        <span className="capitalize">{ticket.category}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        <span>{ticket.technician_name || 'Unassigned'}</span>
                      </div>
                      <span>•</span>
                      <span title={format(new Date(ticket.created_at), 'PPP p')}>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Detail View */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {isCreating ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold tracking-tight">Create New Ticket</h2>
                    <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateTicket} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Problem Category</label>
                        <div className="grid grid-cols-2 gap-3">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setNewTicket({ ...newTicket, category: cat.id })}
                              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                                newTicket.category === cat.id 
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-600' 
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
                              }`}
                            >
                              <cat.icon className={`w-6 h-6 mb-2 ${newTicket.category === cat.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                              <span className={`text-xs font-medium ${newTicket.category === cat.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Requested For</label>
                          <select 
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black"
                            value={newTicket.requested_for}
                            onChange={e => setNewTicket({ ...newTicket, requested_for: e.target.value })}
                          >
                            <option value="">Myself ({currentUser.name})</option>
                            {users.filter(u => u.id !== currentUser.id).map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-gray-400 mt-1 dark:text-gray-500">Select another user if you are creating this ticket on their behalf.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Priority Level</label>
                          <div className="flex gap-2">
                            {(['low', 'medium', 'high', 'critical'] as TicketPriority[]).map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setNewTicket({ ...newTicket, priority: p })}
                                className={`flex-1 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                  newTicket.priority === p 
                                    ? p === 'critical' ? 'bg-rose-50 border-rose-600 text-rose-600 dark:bg-rose-900/20 dark:border-rose-500 dark:text-rose-400' :
                                      p === 'high' ? 'bg-red-50 border-red-600 text-red-600 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400' :
                                      p === 'medium' ? 'bg-amber-50 border-amber-600 text-amber-600 dark:bg-amber-900/20 dark:border-amber-500 dark:text-amber-400' :
                                      'bg-blue-50 border-blue-600 text-blue-600 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Subject</label>
                      <input 
                        required
                        type="text" 
                        value={newTicket.title}
                        onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                        placeholder="e.g., Laptop won't turn on"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-black"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Description</label>
                      <textarea 
                        required
                        rows={4}
                        value={newTicket.description}
                        onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                        placeholder="Please provide more details about the issue..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none bg-white text-black"
                      />
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button 
                        type="submit"
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                      >
                        Submit Ticket
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="px-6 py-3 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : selectedTicket ? (
                <motion.div 
                  key={selectedTicket.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Ticket Header Card */}
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800">
                    {isEditingDetail ? (
                      <form onSubmit={handleUpdateTicket} className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold dark:text-white">Edit Ticket Details</h3>
                          <div className="flex gap-2">
                            <button 
                              type="submit"
                              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                            >
                              Save Changes
                            </button>
                            <button 
                              type="button"
                              onClick={() => setIsEditingDetail(false)}
                              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Category</label>
                            <select 
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                              value={editForm.category}
                              onChange={e => setEditForm({ ...editForm, category: e.target.value as TicketCategory })}
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Requested For</label>
                            <select 
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                              value={editForm.requested_for}
                              onChange={e => setEditForm({ ...editForm, requested_for: e.target.value })}
                            >
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Priority</label>
                            <select 
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                              value={editForm.priority}
                              onChange={e => setEditForm({ ...editForm, priority: e.target.value as TicketPriority })}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Subject</label>
                          <input 
                            required
                            type="text" 
                            value={editForm.title}
                            onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Description</label>
                          <textarea 
                            required
                            rows={4}
                            value={editForm.description}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-white text-black"
                          />
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${getStatusColor(selectedTicket.status)}`}>
                            {selectedTicket.status}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${getPriorityColor(selectedTicket.priority)}`}>
                            {selectedTicket.priority}
                          </span>
                          {selectedTicket.is_escalated && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-600 bg-red-600 text-white flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Escalated
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-mono dark:text-gray-500">#{selectedTicket.id}</span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight mb-2 dark:text-white">{selectedTicket.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4" />
                            <span>
                              {selectedTicket.creator_name}
                              {selectedTicket.requested_for !== selectedTicket.created_by && (
                                <span className="text-gray-400 ml-1 dark:text-gray-500">on behalf of <span className="font-bold text-gray-600 dark:text-gray-300">{selectedTicket.requester_name}</span></span>
                              )}
                            </span>
                          </div>
                          {selectedTicket.technician_name && (
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">{selectedTicket.technician_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span title={format(new Date(selectedTicket.created_at), 'PPP p')}>
                              {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lead/Technician/Creator Controls: Edit */}
                      {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician' || currentUser.id === selectedTicket.created_by) && !isEditingDetail && (
                        <button 
                          onClick={() => {
                            setEditForm({
                              title: selectedTicket.title,
                              description: selectedTicket.description,
                              category: selectedTicket.category,
                              priority: selectedTicket.priority,
                              requested_for: selectedTicket.requested_for
                            });
                            setIsEditingDetail(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-all dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Ticket
                        </button>
                      )}

                      {/* Lead/Technician Controls: Assign */}
                      {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (selectedTicket.status === 'open' || selectedTicket.status === 'assigned' || selectedTicket.status === 'acknowledged') && (
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2 dark:text-indigo-400">
                            {selectedTicket.assigned_to ? 'Re-assign Technician' : 'Assign Technician'}
                          </label>
                          <div className="flex gap-2">
                            <select 
                              className="text-sm bg-white border border-indigo-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                              onChange={(e) => handleAssign(selectedTicket.id, e.target.value)}
                              value={selectedTicket.assigned_to || ""}
                            >
                              <option value="" disabled>Select Tech</option>
                              {users.filter(u => u.role === 'technician' || u.role === 'it_lead' || u.role === 'admin').map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ').toUpperCase()})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="prose prose-sm max-w-none text-gray-600 mb-8 dark:text-gray-400">
                      <p className="text-base leading-relaxed">{selectedTicket.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                          {(() => {
                            const Icon = CATEGORIES.find(c => c.id === selectedTicket.category)?.icon || Laptop;
                            return <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider dark:text-gray-500">Category</p>
                          <p className="text-sm font-medium capitalize dark:text-gray-300">{selectedTicket.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                          <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider dark:text-gray-500">Assigned To</p>
                          <p className="text-sm font-medium dark:text-gray-300">{selectedTicket.technician_name || 'Unassigned'}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!isEditingDetail && (
                <>
                  {/* Technician Controls: Work Log */}
                  {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || selectedTicket.assigned_to === currentUser.id) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800"
                    >
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                        <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Technician Actions
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Update Status</label>
                          <select 
                            value={selectedTicket.status}
                            onChange={(e) => handleStatusUpdate(selectedTicket.id, e.target.value as TicketStatus)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black"
                          >
                            <option value="open">Open</option>
                            <option value="assigned">Assigned</option>
                            <option value="completed">Completed</option>
                            <option value="acknowledged">Acknowledged</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Update Work Progress</label>
                          <textarea 
                            value={workLog}
                            onChange={e => setWorkLog(e.target.value)}
                            placeholder="Describe what you've done to fix the issue..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-white text-black"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleLogWork(selectedTicket.id)}
                            className="flex-1 bg-white border border-indigo-600 text-indigo-600 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition-all dark:bg-transparent dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                          >
                            Log Activity
                          </button>
                          <button 
                            onClick={() => handleComplete(selectedTicket.id)}
                            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                          >
                            Mark as Fixed
                          </button>
                        </div>
                        
                        {/* Escalation Button */}
                        {canEscalate(selectedTicket) && (
                          <button 
                            onClick={() => handleEscalate(selectedTicket.id)}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-all dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Escalate Ticket
                          </button>
                        )}
                        
                        {selectedTicket.is_escalated && (
                          <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2 dark:bg-red-900/10 dark:border-red-900/30">
                            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">This ticket has been escalated.</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* User Controls: Acknowledge / Re-open */}
                  {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || (selectedTicket.created_by === currentUser.id || selectedTicket.requested_for === currentUser.id)) && selectedTicket.status === 'completed' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-50 rounded-3xl border border-green-200 p-8 shadow-sm dark:bg-green-900/10 dark:border-green-900/30"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/40">
                          <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-green-900 dark:text-green-300">Problem Resolved?</h3>
                          <p className="text-sm text-green-700 dark:text-green-400/80">The technician has marked this issue as fixed. Please review the resolution and acknowledge if you are satisfied.</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => handleAcknowledge(selectedTicket.id)}
                          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none"
                        >
                          Acknowledge Resolution
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(selectedTicket.id, 'assigned')}
                          className="flex-1 bg-white border border-rose-200 text-rose-600 py-3 rounded-xl font-bold hover:bg-rose-50 transition-all dark:bg-transparent dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                        >
                          Not Resolved (Re-open)
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {/* Add Comment Section */}
              {!isEditingDetail && (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                    <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Add Comment
                  </h3>
                  <form onSubmit={handleAddComment} className="flex gap-3">
                    <input 
                      type="text"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Type your message here..."
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black"
                    />
                    <button 
                      type="submit"
                      disabled={!comment.trim()}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 dark:shadow-none"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* Activity Log */}
                  <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-800">
                      <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                        <History className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        Activity Log
                      </h3>
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider dark:text-gray-500">{activities.length} Events</span>
                    </div>
                    <div className="p-8">
                      {isLoadingActivities ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                          <p className="text-sm text-gray-500 font-medium dark:text-gray-400">Loading history...</p>
                        </div>
                      ) : (
                        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-100 before:via-gray-200 before:to-transparent dark:before:from-gray-800 dark:before:via-gray-700 dark:before:to-transparent">
                          {activities.map((activity, idx) => (
                            <div key={activity.id} className="relative flex items-start gap-6 group">
                              <div className={`mt-1.5 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 shrink-0 dark:border-[#1C1C1E] ${
                                activity.action === 'completed' ? 'bg-green-500' : 
                                activity.action === 'assigned' ? 'bg-amber-500' :
                                activity.action === 'created' ? 'bg-blue-500' : 
                                activity.action === 'comment' ? 'bg-indigo-600' : 'bg-indigo-500'
                              }`}>
                                {activity.action === 'completed' ? <CheckCircle2 className="w-4 h-4 text-white" /> : 
                                 activity.action === 'assigned' ? <UserIcon className="w-4 h-4 text-white" /> :
                                 activity.action === 'created' ? <Plus className="w-4 h-4 text-white" /> : 
                                 activity.action === 'comment' ? <MessageSquare className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-200">{activity.user_name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500">{activity.user_role.replace('_', ' ')}</span>
                                  </div>
                                  <span 
                                    title={format(new Date(activity.created_at), 'PPP p')}
                                    className="text-[11px] text-gray-400 font-medium dark:text-gray-500"
                                  >
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">{activity.details}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-300 text-gray-400 dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-gray-600">
                  <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4 dark:bg-gray-800">
                    <TicketIcon className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">Select a ticket to view details</h3>
                  <p className="text-sm dark:text-gray-500">Choose from the list on the left to see history and actions</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </main>

    <SettingsModal 
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />

    <Modal
      isOpen={confirmModal.isOpen}
      onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      onConfirm={confirmModal.onConfirm}
      title={confirmModal.title}
      message={confirmModal.message}
      type={confirmModal.type}
      confirmText={confirmModal.confirmText}
    />
  </div>
);
}
