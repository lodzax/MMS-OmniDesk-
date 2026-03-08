import React, { useState, useEffect } from 'react';
import { User, Technician } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User as UserIcon, Phone, Briefcase, CheckCircle2, XCircle, Clock, Loader2, Search, Edit, Trash2 } from 'lucide-react';

interface TechnicianManagementProps {
  users: User[];
}

export const TechnicianManagement: React.FC<TechnicianManagementProps> = ({ users }) => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    id: '',
    specialty: '',
    phone: '',
    status: 'active' as Technician['status']
  });

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/technicians');
      if (!response.ok) throw new Error('Failed to fetch technicians');
      const data = await response.json();
      setTechnicians(data);
    } catch (err) {
      console.error('Error fetching technicians:', err);
      setTechnicians([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTech ? `/api/technicians/${editingTech.id}` : '/api/technicians';
      const method = editingTech ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          specialty: formData.specialty,
          phone: formData.phone,
          status: formData.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save technician');
      }

      setIsAdding(false);
      setEditingTech(null);
      setFormData({ id: '', specialty: '', phone: '', status: 'active' });
      fetchTechnicians();
    } catch (err: any) {
      console.error('Error saving technician:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this technician?')) return;
    try {
      const response = await fetch(`/api/technicians/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete technician');
      fetchTechnicians();
    } catch (err: any) {
      console.error('Error deleting technician:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const availableUsers = users.filter(u => 
    (u.role === 'technician' || u.role === 'user') && 
    !technicians.some(t => t.id === u.id)
  );

  const filteredTechs = Array.isArray(technicians) ? technicians.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Technician Management</h2>
          <p className="text-gray-500 text-sm dark:text-gray-400">Manage your IT support team and their specialties.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          Add Technician
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search technicians by name or specialty..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechs.map(tech => (
            <motion.div 
              key={tech.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all dark:bg-[#1C1C1E] dark:border-gray-800"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center dark:bg-indigo-900/30">
                    <UserIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{tech.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${tech.status === 'active' ? 'bg-green-500' : tech.status === 'on-leave' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{tech.status}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingTech(tech);
                    setFormData({ id: tech.id, specialty: tech.specialty, phone: tech.phone, status: tech.status });
                    setIsAdding(true);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors dark:hover:bg-gray-800 text-gray-400"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(tech.id)}
                  className="p-2 hover:bg-rose-50 rounded-xl transition-colors dark:hover:bg-rose-900/20 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tech.specialty || 'No specialty set'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{tech.phone || 'No phone set'}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  Joined {new Date(tech.created_at).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden dark:bg-[#1C1C1E]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">{editingTech ? 'Edit Technician' : 'Add New Technician'}</h3>
                  <button onClick={() => { setIsAdding(false); setEditingTech(null); }} className="p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-800">
                    <XCircle className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {!editingTech && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Select User</label>
                      <select 
                        required
                        value={formData.id}
                        onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      >
                        <option value="">Select a user...</option>
                        {availableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Specialty</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Network Security, Hardware Repair"
                      value={formData.specialty}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['active', 'inactive', 'on-leave'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                          className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${formData.status === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all mt-4 dark:shadow-none"
                  >
                    {editingTech ? 'Save Changes' : 'Create Technician'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
