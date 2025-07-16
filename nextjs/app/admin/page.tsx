'use client';

import React from 'react';
import { motion } from 'framer-motion';
import AdminPanel from '@/app/components/AdminPanel';

export default function AdminDashboardPage() {
  return (
    <div className="p-6 sm:p-8">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-lg text-gray-600">System-wide management and overview</p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="card p-6 sm:p-8"
      >
        <AdminPanel />
      </motion.div>
    </div>
  );
}
