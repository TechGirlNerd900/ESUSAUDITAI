"use client";

import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function DashboardLayoutClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} setSidebarOpen={setOpen} />
      <div className="flex">
        <Sidebar open={open} setOpen={setOpen} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}