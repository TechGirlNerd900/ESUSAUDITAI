'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Bell, Save } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const router = useRouter();
  const supabase = createClient();

  const checkUser = useCallback(async () => {
    // ... (implementation remains the same)
  }, []);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  async function updateProfile(event: React.FormEvent) {
    // ... (implementation remains the same)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <form onSubmit={updateProfile} className="space-y-6">
              {/* Form fields ... */}
              <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        );
      case 'security':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Security settings content...
          </motion.div>
        );
      case 'notifications':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Notifications settings content...
          </motion.div>
        );
      default:
        return null;
    }
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-lg text-gray-600">Manage your account and preferences</p>
      </header>

      <AnimatePresence>
        {notification.message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg mb-6 text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-1/4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left flex items-center px-4 py-2 rounded-lg ${activeTab === 'profile' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <User className="h-5 w-5 mr-3" /> Profile
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full text-left flex items-center px-4 py-2 rounded-lg ${activeTab === 'security' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <Lock className="h-5 w-5 mr-3" /> Security
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full text-left flex items-center px-4 py-2 rounded-lg ${activeTab === 'notifications' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <Bell className="h-5 w-5 mr-3" /> Notifications
            </button>
          </nav>
        </aside>

        <main className="flex-1 card p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
