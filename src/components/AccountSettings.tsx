import React, { useState, useEffect } from 'react';
import { User, Shield, ShieldCheck, ShieldAlert, UserPlus, Search, Loader2, CheckCircle2, ChevronRight, Mail, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType, Role } from '../types';

interface AccountSettingsProps {
  currentUser: UserType;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/users');
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('Received HTML instead of JSON for /api/users:', text.substring(0, 200));
        throw new Error('Server returned HTML instead of JSON. This usually means the API route is missing or the server is misconfigured.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorData.error || `Failed to fetch users (${response.status})`);
      }
      const data = await response.json();
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to fetch users' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    setUpdatingUserId(userId);
    setMessage(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      const updatedUser = await response.json();
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      setMessage({ type: 'success', text: `Role updated for ${updatedUser.name}!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'admin': return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'it_lead': return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'technician': return <Shield className="w-4 h-4 text-emerald-600" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case 'admin': return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800';
      case 'it_lead': return 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800';
      case 'technician': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
      default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage organization users, roles, and permissions.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-4 py-3 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-gray-800 rounded-2xl text-sm w-full md:w-80 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'}`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          {message.text}
        </motion.div>
      )}

      <div className="bg-white dark:bg-[#1C1C1E] rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-wider text-gray-400">User</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Role</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No users found matching your search.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email || 'No email'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select 
                          disabled={updatingUserId === user.id || user.id === currentUser.id}
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value as Role)}
                          className="text-xs font-bold bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 dark:text-white"
                        >
                          <option value="end_user">End User</option>
                          <option value="technician">Technician</option>
                          <option value="it_lead">IT Lead</option>
                          <option value="admin">Admin</option>
                        </select>
                        {updatingUserId === user.id && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
