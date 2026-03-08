import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Monitor } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose
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
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900">Settings</h3>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600">
                    Your account settings and preferences can be managed here.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 text-center">
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
