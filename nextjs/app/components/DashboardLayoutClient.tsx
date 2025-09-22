'use client';

import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar setSidebarOpen={setOpen} />
      <div>
        <Sidebar open={open} setOpen={setOpen} />
        <main className="lg:ml-64 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
