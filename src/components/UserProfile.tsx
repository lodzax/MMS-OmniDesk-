import React, { useState } from 'react';
import { User, Shield, Mail, Key, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { User as UserType } from '../types';

interface UserProfileProps {
  user: UserType;
  onUpdate: (updatedUser: UserType) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate }) => {
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      onUpdate(updatedUser);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user.email) {
      setMessage({ type: 'error', text: 'Email is required for password reset.' });
      return;
    }

    setResetLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reset email');
      }

      setMessage({ type: 'success', text: 'Password reset email sent! Please check your inbox.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="md:col-span-1 bg-white dark:bg-[#1C1C1E] rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center"
        >
          <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
            <UserIcon className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider dark:bg-indigo-900/20 dark:text-indigo-400">
            <Shield className="w-3 h-3" />
            {user.role}
          </div>
          <div className="mt-6 w-full pt-6 border-t border-gray-50 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span className="truncate">{user.email || 'No email provided'}</span>
            </div>
          </div>
        </motion.div>

        {/* Settings Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="md:col-span-2 space-y-8"
        >
          <div className="bg-white dark:bg-[#1C1C1E] rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Profile Information</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 dark:text-gray-400">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  placeholder="Your Name"
                />
              </div>

              {message && (
                <div className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  {message.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 dark:shadow-none"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-[#1C1C1E] rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Security</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Update your password to keep your account secure.</p>
            
            <button 
              onClick={handleResetPassword}
              disabled={resetLoading}
              className="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
            >
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Reset Password via Email
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
