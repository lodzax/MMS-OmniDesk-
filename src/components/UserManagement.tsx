import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldCheck, 
  User as UserIcon, 
  UserCog, 
  Loader2, 
  Check, 
  X,
  ChevronDown,
  Mail,
  Calendar,
  History,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

interface UserManagementProps {
  currentUser: User;
}

interface AuditLogEntry {
  id: number;
  user_id: string;
  changed_by: string | null;
  old_role: string;
  new_role: string;
  old_name: string;
  new_name: string;
  changed_at: string;
  changed_by_user?: { name: string };
}

const ROLE_CONFIG: Record<Role, { label: string; icon: any; color: string; bg: string }> = {
  admin: { label: 'Admin', icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50' },
  it_lead: { label: 'IT Lead', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  technician: { label: 'Technician', icon: UserCog, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  end_user: { label: 'End User', icon: UserIcon, color: 'text-gray-600', bg: 'bg-gray-50' },
};

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);
  const [selectedUserForAudit, setSelectedUserForAudit] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async (userId: string) => {
    setIsLoadingAudit(true);
    try {
      const response = await fetch(`/api/users/${userId}/audit-log`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    setUpdatingUserId(userId);
    setShowRoleDropdown(null);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: newRole,
          changed_by: currentUser.id 
        })
      });

      if (!response.ok) throw new Error('Failed to update role');
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentUser.role !== 'admin' && currentUser.role !== 'it_lead') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-16 h-16 text-rose-200 mb-4" />
        <h3 className="text-xl font-bold">Access Denied</h3>
        <p className="text-gray-500">Only administrators can manage user roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-gray-500 text-sm dark:text-gray-400">Manage system access and assign roles to users.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl flex items-center gap-2 dark:bg-indigo-900/20">
          <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{users.length} Total Users</span>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:bg-[#1C1C1E] dark:border-gray-800 dark:text-white"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-gray-200 overflow-hidden shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map(user => {
                  const roleInfo = ROLE_CONFIG[user.role as Role] || ROLE_CONFIG.end_user;
                  const RoleIcon = roleInfo.icon;
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-800/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${roleInfo.bg} flex items-center justify-center dark:bg-opacity-10`}>
                            <UserIcon className={`w-5 h-5 ${roleInfo.color}`} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{user.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button 
                            onClick={() => setShowRoleDropdown(showRoleDropdown === user.id ? null : user.id)}
                            disabled={updatingUserId === user.id || user.id === currentUser.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all ${user.id === currentUser.id ? 'cursor-not-allowed opacity-70' : 'hover:border-gray-200 dark:hover:border-gray-700'}`}
                          >
                            <RoleIcon className={`w-4 h-4 ${roleInfo.color}`} />
                            <span className={`text-xs font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                            {user.id !== currentUser.id && <ChevronDown className="w-3 h-3 text-gray-400" />}
                          </button>

                          <AnimatePresence>
                            {showRoleDropdown === user.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(null)}></div>
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute left-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-20 dark:bg-[#2C2C2E] dark:border-gray-800"
                                >
                                  {(Object.keys(ROLE_CONFIG) as Role[]).map(roleKey => {
                                    const r = ROLE_CONFIG[roleKey];
                                    const RIcon = r.icon;
                                    return (
                                      <button
                                        key={roleKey}
                                        onClick={() => handleUpdateRole(user.id, roleKey)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${user.role === roleKey ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                      >
                                        <RIcon className={`w-4 h-4 ${user.role === roleKey ? 'text-indigo-600' : 'text-gray-400'}`} />
                                        <span className="text-xs font-bold">{r.label}</span>
                                        {user.role === roleKey && <Check className="w-3 h-3 ml-auto text-indigo-600" />}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedUserForAudit(user);
                              fetchAuditLogs(user.id);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors dark:hover:bg-gray-800 text-gray-400 hover:text-indigo-600"
                            title="View Audit Log"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {updatingUserId === user.id ? (
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          ) : (
                            <div className="text-xs font-bold text-gray-400 min-w-[40px]">
                              {user.id === currentUser.id ? '(You)' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No users found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search term.</p>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Modal */}
      <AnimatePresence>
        {selectedUserForAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden dark:bg-[#1C1C1E]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold">Audit Log</h3>
                    <p className="text-sm text-gray-500">Changes for {selectedUserForAudit.name}</p>
                  </div>
                  <button onClick={() => setSelectedUserForAudit(null)} className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-800">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                  {isLoadingAudit ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>No changes recorded for this user.</p>
                    </div>
                  ) : (
                    auditLogs.map(log => (
                      <div key={log.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 dark:bg-gray-800/50 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center dark:bg-indigo-900/30">
                              <UserIcon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {log.changed_by_user?.name || 'System'}
                            </span>
                            <span className="text-xs text-gray-400">made a change</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {format(new Date(log.changed_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {log.old_role !== log.new_role && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role Change</span>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500 dark:bg-gray-800">{log.old_role}</span>
                                <ArrowRight className="w-3 h-3 text-gray-300" />
                                <span className="px-2 py-0.5 bg-indigo-50 rounded text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{log.new_role}</span>
                              </div>
                            </div>
                          )}
                          {log.old_name !== log.new_name && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name Change</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 line-through">{log.old_name}</span>
                                <ArrowRight className="w-3 h-3 text-gray-300" />
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{log.new_name}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
