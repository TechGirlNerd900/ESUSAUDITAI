import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardLayoutClient from '../components/DashboardLayoutClient';

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}