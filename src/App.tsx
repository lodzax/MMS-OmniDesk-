import React, { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { Dashboard } from './components/Dashboard';
import { TechnicianManagement } from './components/TechnicianManagement';
import { UserManagement } from './components/UserManagement';
import { UserProfile } from './components/UserProfile';
import { AccountSettings } from './components/AccountSettings';
import { Modal } from './components/Modal';
import { SettingsModal } from './components/SettingsModal';
import { KnowledgeBaseSuggestions } from './components/KnowledgeBaseSuggestions';
import { 
  Ticket as TicketIcon, 
  Plus, 
  User as UserIcon, 
  Settings, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare, 
  History,
  Inbox,
  Laptop,
  Monitor,
  HelpCircle,
  Wifi,
  Printer,
  Code2,
  Filter,
  LogOut,
  ShieldCheck,
  Star,
  Bell,
  X,
  Search,
  Edit,
  LayoutDashboard,
  Trash2,
  Check,
  List,
  Loader2,
  Users,
  Tag,
  ExternalLink,
  Book,
  Lightbulb,
  ArrowRight,
  Smartphone,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format, addHours } from 'date-fns';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { User, Ticket, Activity, Role, TicketCategory, TicketStatus, TicketPriority, Notification, Dependency, KnowledgeBaseArticle } from './types';
import { SLA_HOURS, SLA_LABELS } from './constants';

const CATEGORIES: { id: TicketCategory; label: string; icon: any }[] = [
  { id: 'laptop', label: 'Laptop', icon: Laptop },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'mobile', label: 'Mobile Device', icon: Smartphone },
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
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'sla_status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter, categoryFilter, tagFilter, searchTerm, sortBy, sortOrder]);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'laptop' as TicketCategory, priority: 'medium' as TicketPriority, requested_for: '', tags: [] as string[] });
  const [newTicket, setNewTicket] = useState({ title: '', description: '', category: 'laptop' as TicketCategory, priority: 'medium' as TicketPriority, requested_for: '', tags: [] as string[] });
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
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
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isAddingDependency, setIsAddingDependency] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [isResolutionExpanded, setIsResolutionExpanded] = useState(false);
  const [dependencySearch, setDependencySearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [ticketsPerPage] = useState(10);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
    return tickets;
  }, [tickets]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session check error:', error);
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          supabase.auth.signOut();
        }
        setIsAuthLoading(false);
        return;
      }
      
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setIsAuthLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
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

  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> => {
    try {
      const response = await fetch(url, options);
      
      // Handle potential HTML response when JSON is expected
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html') && retries > 0) {
        console.warn(`Received HTML instead of JSON for ${url}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }

      // Retry on 5xx errors
      if (response.status >= 500 && retries > 0) {
        console.warn(`Server error ${response.status} for ${url}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      
      return response;
    } catch (err: any) {
      // Retry on network errors
      if (err.message.includes('Failed to fetch') && retries > 0) {
        console.warn(`Network error for ${url}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    if (!userId || userId === 'undefined') {
      console.warn('fetchUserProfile called with invalid userId:', userId);
      setIsAuthLoading(false);
      return;
    }

    try {
      console.log(`Fetching profile for user: ${userId}`);
      const response = await fetchWithRetry(`/api/users/${userId}`);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Received HTML response from API. This usually means the API route was not found or the server is misconfigured.');
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `Server error (${response.status})` };
        }

        if (response.status === 404) {
          console.warn('User profile not found, signing out...');
          supabase.auth.signOut();
          throw new Error(errorData.error || 'User profile not found');
        }
        
        throw new Error(errorData.error || `Failed to fetch profile (${response.status})`);
      }

      const data = await response.json();
      if (data) {
        console.log('Profile fetched successfully:', data.name);
        setCurrentUser(data);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      // Only show alert if it's not a background refresh
      if (!err.message.includes('Failed to fetch')) {
        alert(`Error fetching profile: ${err.message}. Please try refreshing the page.`);
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
          
          // Show toast for new ticket notifications
          if (data.data.message.includes('New ticket created')) {
            toast.info('New Ticket Alert', {
              description: data.data.message,
              action: {
                label: 'View',
                onClick: () => {
                  // If we can find the ticket in our list, select it
                  // Otherwise, we might need to fetch it or just refresh the list
                  fetchTickets();
                }
              }
            });
          } else {
            toast(data.data.message);
          }
        }
      };
      
      return () => ws.close();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedTicket) {
      fetchActivities(selectedTicket.id);
      fetchDependencies(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchUsers = async () => {
    try {
      const response = await fetchWithRetry('/api/users');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorData.error || `Failed to fetch users (${response.status})`);
      }
      const data = await response.json();
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTickets = async () => {
    if (!currentUser) return;
    setIsLoadingTickets(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ticketsPerPage.toString(),
        user_id: currentUser.id,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        tag: tagFilter,
        search: searchTerm,
        sortBy,
        sortOrder
      });

      const response = await fetchWithRetry(`/api/tickets?${params.toString()}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
      }
      const data = await response.json();
      setTickets(data.tickets);
      setTotalTickets(data.totalCount);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTickets();
    }
  }, [currentUser, currentPage, statusFilter, priorityFilter, categoryFilter, tagFilter, searchTerm, sortBy, sortOrder]);

  const fetchAllTickets = async () => {
    if (!currentUser) return;
    try {
      const params = new URLSearchParams({
        limit: '1000', // Fetch a large enough amount for the dashboard
        user_id: currentUser.id
      });
      const response = await fetchWithRetry(`/api/tickets?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAllTickets(data.tickets);
      }
    } catch (err) {
      console.error('Error fetching all tickets for dashboard:', err);
    }
  };

  useEffect(() => {
    if (currentUser && view === 'dashboard') {
      fetchAllTickets();
    }
  }, [currentUser, view]);

  const fetchActivities = async (ticketId: string) => {
    setIsLoadingActivities(true);
    try {
      const response = await fetchWithRetry(`/api/tickets/${ticketId}/activities`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchDependencies = async (ticketId: string) => {
    try {
      const response = await fetchWithRetry(`/api/tickets/${ticketId}/dependencies`);
      if (!response.ok) throw new Error('Failed to fetch dependencies');
      const data = await response.json();
      setDependencies(data);
    } catch (err) {
      console.error('Error fetching dependencies:', err);
    }
  };

  const handleAddDependency = async (dependsOnId: string) => {
    if (!currentUser || !selectedTicket) return;
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depends_on_id: dependsOnId, user_id: currentUser.id })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add dependency');
      }
      fetchDependencies(selectedTicket.id);
      fetchActivities(selectedTicket.id);
      setIsAddingDependency(false);
      setDependencySearch('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveDependency = async (depId: number) => {
    if (!currentUser || !selectedTicket) return;
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/dependencies/${depId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      if (!response.ok) throw new Error('Failed to remove dependency');
      fetchDependencies(selectedTicket.id);
      fetchActivities(selectedTicket.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const response = await fetchWithRetry(`/api/notifications/${userId}`);
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
              requested_for: requesterId,
              tags: newTicket.tags
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to create ticket');
            throw new Error(errorMsg);
          }

          setIsCreating(false);
          setNewTicket({ title: '', description: '', category: 'laptop', priority: 'medium', requested_for: '', tags: [] });
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

  const handleRateTicket = async (ticketId: string, rating: number) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          rating
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rate ticket');
      }

      fetchTickets();
      fetchActivities(ticketId);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, rating } : null);
      }
    } catch (err: any) {
      console.error('Error rating ticket:', err);
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
    setIsEscalating(true);
    setEscalationReason('');
  };

  const submitEscalation = async () => {
    if (!selectedTicket || !currentUser) return;
    
    const ticketId = selectedTicket.id;
    const reason = escalationReason || "Unresolved for too long";
    
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

      setIsEscalating(false);
      fetchTickets();
      fetchActivities(ticketId);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, is_escalated: true, priority: 'critical', escalation_reason: reason } : null);
      }
    } catch (err: any) {
      console.error('Error escalating ticket:', err);
      alert(`Error: ${err.message}`);
    }
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

  const handleLinkArticle = async (article: KnowledgeBaseArticle) => {
    if (!currentUser || !selectedTicket) return;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          comment: `Reference Knowledge Base Article: ${article.title}\n\n${article.content.substring(0, 200)}...`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = typeof errorData.error === 'object' ? JSON.stringify(errorData.error) : (errorData.error || 'Failed to link article');
        throw new Error(errorMsg);
      }

      fetchActivities(selectedTicket.id);
    } catch (err: any) {
      console.error('Error linking article:', err);
      alert(`Error linking article: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'assigned': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'in_progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
      <Toaster position="top-right" richColors />
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 dark:bg-[#1C1C1E] dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <TicketIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight dark:text-white">OmniDesk</h1>
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
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden dark:bg-[#1C1C1E] dark:border-gray-800"
                  >
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
                      <h3 className="font-bold text-sm dark:text-white">Notifications</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
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
                                setIsResolutionExpanded(ticket.status === 'completed' || ticket.status === 'acknowledged');
                              }
                              setShowNotifications(false);
                            }}
                            className={`p-4 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-800/50 ${!n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                <TicketIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <p className={`text-xs leading-relaxed ${!n.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
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
            tickets={allTickets} 
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            categoryFilter={categoryFilter}
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
                  className="flex-1 text-sm bg-white dark:bg-transparent border-none focus:ring-0 outline-none font-medium text-black dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white dark:bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-black dark:text-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="acknowledged">Acknowledged</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white dark:bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-black dark:text-white"
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
                  className="flex-1 text-sm bg-white dark:bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-black dark:text-white"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <Tag className={`w-4 h-4 ${tagFilter ? 'text-indigo-600' : 'text-gray-400'}`} />
                <input 
                  type="text"
                  placeholder="Filter by tag..."
                  className="flex-1 text-sm bg-transparent border-none focus:ring-0 font-medium text-black placeholder:text-gray-400 dark:text-white"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                />
                {tagFilter && (
                  <button onClick={() => setTagFilter('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-200 flex items-center gap-3 dark:bg-[#1C1C1E] dark:border-gray-800">
                <History className="w-4 h-4 text-gray-400" />
                <select 
                  className="flex-1 text-sm bg-white dark:bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-black dark:text-white"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="created_at">Sort by Created Date</option>
                  <option value="updated_at">Sort by Updated Date</option>
                  <option value="sla_status">Sort by SLA Priority</option>
                </select>
                <button 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 hover:bg-gray-100 rounded-md dark:hover:bg-gray-800 transition-colors"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
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
                      setIsResolutionExpanded(ticket.status === 'completed' || ticket.status === 'acknowledged');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-indigo-50/50 border-indigo-600 shadow-md ring-1 ring-indigo-600 dark:bg-indigo-900/10 dark:border-indigo-500 dark:ring-indigo-500' 
                        : ticket.is_blocked
                          ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300 dark:bg-amber-900/5 dark:border-amber-900/20'
                          : ticket.is_escalated
                            ? 'bg-red-50/30 border-red-200 hover:border-red-300 dark:bg-red-900/5 dark:border-red-900/30'
                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800 dark:hover:border-indigo-700'
                    }`}
                  >
                    {selectedTicket?.id === ticket.id && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${ticket.is_blocked ? 'bg-amber-500' : ticket.is_escalated ? 'bg-red-600' : 'bg-indigo-600 dark:bg-indigo-500'}`} />
                    )}
                    {ticket.is_blocked && selectedTicket?.id !== ticket.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400/50" />
                    )}
                    {ticket.is_escalated && !ticket.is_blocked && selectedTicket?.id !== ticket.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400/50" />
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
                          {ticket.is_blocked && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-600 bg-amber-600 text-white flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Blocked
                            </span>
                          )}
                          {ticket.sla_status && ticket.sla_status !== 'resolved' && (
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              ticket.sla_status === 'breached' 
                                ? 'border-red-600 bg-red-600 text-white' 
                                : ticket.sla_status === 'approaching'
                                  ? 'border-amber-500 bg-amber-500 text-white'
                                  : 'border-emerald-500 bg-emerald-500 text-white'
                            }`}>
                              <Clock className="w-2.5 h-2.5" />
                              SLA: {ticket.sla_status.replace('_', ' ')}
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
                    {ticket.tags && ticket.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ticket.tags.map(tag => (
                          <button 
                            key={tag} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(tag);
                            }}
                            className="px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-md text-[9px] font-bold uppercase tracking-wider dark:bg-gray-800 dark:text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {!isLoadingTickets && totalTickets > 0 && (
              <div className="mt-6 flex items-center justify-between px-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Showing <span className="font-bold text-gray-900 dark:text-gray-200">{(currentPage - 1) * ticketsPerPage + 1}</span> to <span className="font-bold text-gray-900 dark:text-gray-200">{Math.min(currentPage * ticketsPerPage, totalTickets)}</span> of <span className="font-bold text-gray-900 dark:text-gray-200">{totalTickets}</span> tickets
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: Math.min(5, Math.ceil(totalTickets / ticketsPerPage)) }, (_, i) => {
                    const totalPages = Math.ceil(totalTickets / ticketsPerPage);
                    let pageNum = currentPage;
                    if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    
                    if (pageNum <= 0 || pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalTickets / ticketsPerPage), prev + 1))}
                    disabled={currentPage === Math.ceil(totalTickets / ticketsPerPage)}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail View */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {isCreating ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold tracking-tight dark:text-white">Create New Ticket</h2>
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
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-500 dark:text-indigo-400' 
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200 dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-gray-500 dark:hover:border-indigo-900/50'
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
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                          <p className="text-[10px] text-gray-400 mt-1 dark:text-gray-500">
                            SLA Target: <span className="font-bold text-gray-600 dark:text-gray-300">
                              {format(addHours(new Date(), SLA_HOURS[newTicket.priority]), 'MMM d, h:mm a')}
                            </span> ({SLA_HOURS[newTicket.priority]}h resolution)
                          </p>
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>

                    <KnowledgeBaseSuggestions 
                      query={newTicket.title + ' ' + newTicket.description}
                      onLinkArticle={(article) => {
                        const linkText = `\n\n--- Reference: ${article.title} ---\n${article.content.substring(0, 100)}...\n`;
                        setNewTicket({ ...newTicket, description: newTicket.description + linkText });
                      }}
                    />

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Tags</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {newTicket.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium flex items-center gap-1">
                            {tag}
                            <button type="button" onClick={() => setNewTicket({ ...newTicket, tags: newTicket.tags.filter(t => t !== tag) })} className="hover:text-indigo-800">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (tagInput.trim() && !newTicket.tags.includes(tagInput.trim())) {
                                setNewTicket({ ...newTicket, tags: [...newTicket.tags, tagInput.trim()] });
                                setTagInput('');
                              }
                            }
                          }}
                          placeholder="Add a tag and press Enter"
                          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-black text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (tagInput.trim() && !newTicket.tags.includes(tagInput.trim())) {
                              setNewTicket({ ...newTicket, tags: [...newTicket.tags, tagInput.trim()] });
                              setTagInput('');
                            }
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm font-medium"
                        >
                          Add
                        </button>
                      </div>
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
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                              value={editForm.priority}
                              onChange={e => setEditForm({ ...editForm, priority: e.target.value as TicketPriority })}
                            >
                              <option value="low">Low (48h SLA)</option>
                              <option value="medium">Medium (24h SLA)</option>
                              <option value="high">High (8h SLA)</option>
                              <option value="critical">Critical (4h SLA)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1 dark:text-gray-500">
                              New SLA Target: <span className="font-bold text-gray-600 dark:text-gray-300">
                                {format(addHours(new Date(), SLA_HOURS[editForm.priority]), 'MMM d, h:mm a')}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Tags</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {editForm.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium flex items-center gap-1">
                                {tag}
                                <button type="button" onClick={() => setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tag) })} className="hover:text-indigo-800">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={editTagInput}
                              onChange={e => setEditTagInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (editTagInput.trim() && !editForm.tags.includes(editTagInput.trim())) {
                                    setEditForm({ ...editForm, tags: [...editForm.tags, editTagInput.trim()] });
                                    setEditTagInput('');
                                  }
                                }
                              }}
                              placeholder="Add a tag and press Enter"
                              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white text-black text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                if (editTagInput.trim() && !editForm.tags.includes(editTagInput.trim())) {
                                  setEditForm({ ...editForm, tags: [...editForm.tags, editTagInput.trim()] });
                                  setEditTagInput('');
                                }
                              }}
                              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm font-medium"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Subject</label>
                          <input 
                            required
                            type="text" 
                            value={editForm.title}
                            onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">Description</label>
                          <textarea 
                            required
                            rows={4}
                            value={editForm.description}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                          {dependencies.some(d => d.ticket?.status !== 'completed' && d.ticket?.status !== 'acknowledged') && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-amber-600 bg-amber-600 text-white flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Blocked
                            </span>
                          )}
                          {selectedTicket.sla_status && selectedTicket.sla_status !== 'resolved' && (
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                              selectedTicket.sla_status === 'breached' 
                                ? 'border-red-600 bg-red-600 text-white' 
                                : selectedTicket.sla_status === 'approaching'
                                  ? 'border-amber-500 bg-amber-500 text-white'
                                  : 'border-emerald-500 bg-emerald-500 text-white'
                            }`}>
                              <Clock className="w-3 h-3" />
                              SLA: {selectedTicket.sla_status.replace('_', ' ')}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-mono dark:text-gray-500">#{selectedTicket.id}</span>
                        </div>

                        {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {selectedTicket.tags.map(tag => (
                              <button 
                                key={tag} 
                                onClick={() => {
                                  setTagFilter(tag);
                                  setSelectedTicket(null);
                                }}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-wider dark:bg-gray-800 dark:text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        )}

                        <h2 className="text-2xl font-bold tracking-tight mb-2 dark:text-white">{selectedTicket.title}</h2>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                          {selectedTicket.sla_target_time && selectedTicket.status !== 'completed' && selectedTicket.status !== 'acknowledged' && (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className={`w-4 h-4 ${selectedTicket.sla_status === 'breached' ? 'text-red-500' : 'text-amber-500'}`} />
                              <span className="font-medium">
                                Target: {format(new Date(selectedTicket.sla_target_time), 'MMM d, h:mm a')}
                                <span className="text-xs text-gray-400 ml-1">
                                  ({formatDistanceToNow(new Date(selectedTicket.sla_target_time), { addSuffix: true })})
                                </span>
                              </span>
                            </div>
                          )}
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
                              requested_for: selectedTicket.requested_for,
                              tags: selectedTicket.tags || []
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
                              className="text-sm bg-white border border-indigo-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 text-black dark:bg-gray-800 dark:border-indigo-900/50 dark:text-white"
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

                    {selectedTicket.status !== 'completed' && selectedTicket.status !== 'acknowledged' && (
                      <div className="mb-8">
                        <KnowledgeBaseSuggestions 
                          query={selectedTicket.title + ' ' + selectedTicket.description}
                          onLinkArticle={handleLinkArticle}
                        />
                      </div>
                    )}

                    {/* Resolution Details Section */}
                    {(selectedTicket.status === 'completed' || selectedTicket.status === 'acknowledged' || activities.some(a => a.action === 'update' && a.details !== 'Ticket details updated.')) && (
                      <div className="mb-8 p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
                        <button 
                          onClick={() => setIsResolutionExpanded(!isResolutionExpanded)}
                          className="w-full flex items-center justify-between group"
                        >
                          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Resolution Details
                          </h3>
                          {isResolutionExpanded ? (
                            <ChevronUp className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                          )}
                        </button>
                        
                        <AnimatePresence>
                          {isResolutionExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-4 space-y-4">
                                {activities
                                  .filter(a => (a.action === 'update' && a.details !== 'Ticket details updated.') || a.action === 'completed' || a.action === 'acknowledged')
                                  .length > 0 ? (
                                    activities
                                      .filter(a => (a.action === 'update' && a.details !== 'Ticket details updated.') || a.action === 'completed' || a.action === 'acknowledged')
                                      .map((activity) => (
                                        <div key={activity.id} className="p-3 bg-white rounded-xl border border-indigo-100/50 shadow-sm dark:bg-gray-900 dark:border-indigo-900/20">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-gray-900 dark:text-gray-200">{activity.user_name}</span>
                                            <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                                          </div>
                                          <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{activity.details}"</p>
                                        </div>
                                      ))
                                  ) : (
                                    <p className="text-sm text-gray-400 italic pt-2">No resolution steps logged yet.</p>
                                  )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Dependencies Section */}
                    <div className="mb-8 p-6 rounded-2xl bg-gray-50 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <List className="w-4 h-4" />
                          Task Dependencies
                        </h3>
                        {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
                          <button 
                            onClick={() => setIsAddingDependency(!isAddingDependency)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Dependency
                          </button>
                        )}
                      </div>

                      {isAddingDependency && (
                        <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-700">
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                              type="text"
                              placeholder="Search tickets by title or ID..."
                              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                              value={dependencySearch}
                              onChange={(e) => setDependencySearch(e.target.value)}
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {tickets
                              .filter(t => t.id !== selectedTicket.id && !dependencies.some(d => d.depends_on_id === t.id))
                              .filter(t => t.title.toLowerCase().includes(dependencySearch.toLowerCase()) || t.id.toLowerCase().includes(dependencySearch.toLowerCase()))
                              .map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleAddDependency(t.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-between group dark:hover:bg-gray-800"
                                >
                                  <span className="truncate mr-2 dark:text-gray-300">{t.title} <span className="text-gray-400 font-mono text-xs">#{t.id}</span></span>
                                  <Plus className="w-3 h-3 text-gray-300 group-hover:text-indigo-500" />
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {dependencies.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No dependencies linked to this ticket.</p>
                      ) : (
                        <div className="space-y-2">
                          {dependencies.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dep.ticket?.status === 'completed' || dep.ticket?.status === 'acknowledged' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                <div className="truncate">
                                  <p className="text-sm font-medium truncate dark:text-gray-200">{dep.ticket?.title}</p>
                                  <p className="text-[10px] text-gray-400 font-mono">#{dep.depends_on_id} • {dep.ticket?.status}</p>
                                </div>
                              </div>
                              {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician') && (
                                <button 
                                  onClick={() => handleRemoveDependency(dep.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
                  {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || currentUser.role === 'technician' || selectedTicket.assigned_to === currentUser.id) && (
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
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                          >
                            <option value="open">Open</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
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
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            rows={3}
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {selectedTicket.status !== 'in_progress' && (
                            <button 
                              onClick={() => handleStatusUpdate(selectedTicket.id, 'in_progress')}
                              className="flex-1 min-w-[120px] bg-indigo-50 border border-indigo-200 text-indigo-700 py-2.5 rounded-xl font-semibold hover:bg-indigo-100 transition-all dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                            >
                              Start Working
                            </button>
                          )}
                          <button 
                            onClick={() => handleLogWork(selectedTicket.id)}
                            className="flex-1 min-w-[120px] bg-white border border-indigo-600 text-indigo-600 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition-all dark:bg-transparent dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                          >
                            Log Activity
                          </button>
                          <button 
                            onClick={() => handleComplete(selectedTicket.id)}
                            className="flex-1 min-w-[120px] bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
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
                          <div className="mt-2 p-4 bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/10 dark:border-red-900/30">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Ticket Escalated</span>
                            </div>
                            {selectedTicket.escalation_reason && (
                              <p className="text-sm text-red-600/80 dark:text-red-400/80 italic">
                                "{selectedTicket.escalation_reason}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* User Controls: Acknowledge / Re-open */}
                  {(currentUser.role === 'it_lead' || currentUser.role === 'admin' || (selectedTicket.created_by === currentUser.id || selectedTicket.requested_for === currentUser.id)) && (selectedTicket.status === 'completed' || selectedTicket.status === 'acknowledged') && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`${selectedTicket.status === 'completed' ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-gray-50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-800'} rounded-3xl border p-8 shadow-sm`}
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-full ${selectedTicket.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'} flex items-center justify-center`}>
                          {selectedTicket.status === 'completed' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                          ) : (
                            <Inbox className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold ${selectedTicket.status === 'completed' ? 'text-green-900 dark:text-green-300' : 'text-gray-900 dark:text-gray-300'}`}>
                            {selectedTicket.status === 'completed' ? 'Problem Resolved?' : 'Ticket Closed'}
                          </h3>
                          <p className={`text-sm ${selectedTicket.status === 'completed' ? 'text-green-700 dark:text-green-400/80' : 'text-gray-600 dark:text-gray-400/80'}`}>
                            {selectedTicket.status === 'completed' 
                              ? "The technician has marked this issue as fixed. Please review the resolution and acknowledge if you are satisfied."
                              : "This ticket has been acknowledged and closed. If the problem persists, you can re-open it."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {selectedTicket.status === 'completed' && (
                          <button 
                            onClick={() => handleAcknowledge(selectedTicket.id)}
                            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none"
                          >
                            Acknowledge Resolution
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Re-open Ticket',
                              message: 'Are you sure you want to re-open this ticket? It will be moved back to "Assigned" status.',
                              type: 'info',
                              confirmText: 'Re-open',
                              onConfirm: () => handleStatusUpdate(selectedTicket.id, 'assigned')
                            });
                          }}
                          className={`flex-1 bg-white border ${selectedTicket.status === 'completed' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'} py-3 rounded-xl font-bold transition-all dark:bg-transparent dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800`}
                        >
                          {selectedTicket.status === 'completed' ? 'Not Resolved (Re-open)' : 'Re-open Ticket'}
                        </button>
                      </div>

                      {/* Rating Section */}
                      {(selectedTicket.status === 'completed' || selectedTicket.status === 'acknowledged') && 
                       (selectedTicket.created_by === currentUser.id || selectedTicket.requested_for === currentUser.id) && (
                        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">How would you rate the resolution?</h4>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleRateTicket(selectedTicket.id, star)}
                                className="p-1 transition-transform hover:scale-110"
                              >
                                <Star 
                                  className={`w-8 h-8 ${
                                    (selectedTicket.rating || 0) >= star 
                                      ? 'fill-amber-400 text-amber-400' 
                                      : 'text-gray-300 dark:text-gray-700'
                                  }`} 
                                />
                              </button>
                            ))}
                            {selectedTicket.rating && (
                              <span className="ml-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                                {selectedTicket.rating}/5 Rated
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </>
              )}

              {/* Communication & History Section */}
              {!isEditingDetail && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800">
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-800">
                      <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                        <History className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        Activity & Comments
                      </h3>
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider dark:text-gray-500">{activities.length} Events</span>
                    </div>
                    
                    <div className="p-8">
                      {/* Add Comment Input at the top of the history */}
                      <div className="mb-10">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 dark:text-gray-400">Add a comment</label>
                        <form onSubmit={handleAddComment} className="flex gap-3">
                          <input 
                            type="text"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Type your message here..."
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-black dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                                activity.action === 'assigned' || activity.action === 're-assigned' ? 'bg-amber-500' :
                                activity.action === 'created' ? 'bg-blue-500' : 
                                activity.action === 'commented' ? 'bg-indigo-600' : 
                                activity.action === 'escalated' ? 'bg-red-600' :
                                activity.action === 'status_change' ? 'bg-slate-500' :
                                'bg-indigo-500'
                              }`}>
                                {activity.action === 'completed' ? <CheckCircle2 className="w-4 h-4 text-white" /> : 
                                 activity.action === 'assigned' || activity.action === 're-assigned' ? <UserIcon className="w-4 h-4 text-white" /> :
                                 activity.action === 'created' ? <Plus className="w-4 h-4 text-white" /> : 
                                 activity.action === 'commented' ? <MessageSquare className="w-4 h-4 text-white" /> : 
                                 activity.action === 'escalated' ? <AlertCircle className="w-4 h-4 text-white" /> :
                                 activity.action === 'status_change' ? <Clock className="w-4 h-4 text-white" /> :
                                 <History className="w-4 h-4 text-white" />}
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
                                <div className={`p-4 rounded-2xl ${activity.action === 'commented' ? 'bg-indigo-50/50 border border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30' : 'bg-gray-50/50 border border-gray-100 dark:bg-gray-800/30 dark:border-gray-800'}`}>
                                  <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">{activity.details}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
      theme={theme}
      onToggleTheme={toggleTheme}
    />

    <Modal
      isOpen={isEscalating}
      onClose={() => setIsEscalating(false)}
      onConfirm={submitEscalation}
      title="Escalate Ticket"
      message="Please provide a reason for escalating this ticket. This will notify all IT Leads and set the priority to Critical."
      type="warning"
      confirmText="Escalate Now"
    >
      <div className="mt-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Escalation Reason</label>
        <textarea
          autoFocus
          value={escalationReason}
          onChange={(e) => setEscalationReason(e.target.value)}
          placeholder="e.g., SLA breached, critical business impact, unresolved for 48h..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-white dark:bg-gray-800 text-black dark:text-white text-sm"
          rows={3}
        />
      </div>
    </Modal>

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
