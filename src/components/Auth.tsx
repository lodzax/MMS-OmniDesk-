import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2, ShieldCheck } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'user' | 'technician' | 'lead'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        
        // Fetch user profile from our backend
        const response = await fetch(`/api/users/${data.user.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'User profile not found. Please contact an administrator.');
        }
        const profile = await response.json();
        onAuthSuccess(profile);
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role
            }
          }
        });
        if (authError) throw authError;

        if (data.user) {
          setError('Signup successful! Please check your email for confirmation.');
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-4 dark:bg-[#000000]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 dark:bg-[#1C1C1E] dark:border-gray-800"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OmniDesk IT</h1>
            <p className="text-gray-500 text-sm dark:text-gray-400">Helpdesk Management System</p>
          </div>

          <div className="flex p-1 bg-gray-100 rounded-2xl mb-8 dark:bg-gray-800">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 dark:text-gray-400">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      required 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Role</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="user">Standard User</option>
                    <option value="technician">Technician</option>
                    <option value="lead">IT Lead</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className={`p-3 rounded-xl text-xs font-medium ${error.includes('successful') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 dark:shadow-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
