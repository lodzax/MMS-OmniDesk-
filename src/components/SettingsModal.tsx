import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Monitor, Moon, Sun } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors duration-300"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h3>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your account settings and preferences can be managed here.
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Appearance</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Choose your preferred theme</p>
                      </div>
                    </div>
                    <button
                      onClick={onToggleTheme}
                      className="relative inline-flex h-9 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    >
                      <div className={`absolute left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm transition-all duration-300 ${theme === 'dark' ? 'translate-x-11' : 'translate-x-0'}`}>
                        {theme === 'light' ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Moon className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>
                      <span className="sr-only">Toggle theme</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">
                    OmniDesk v1.0.0 • Made with ❤️ for IT Support
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
