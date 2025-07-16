import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// Force dynamic rendering since we're using cookies
export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Handle refresh token errors by clearing session
    if (error && error.message?.includes('refresh_token_not_found')) {
      // Clear the session silently and continue to render auth layout
      await supabase.auth.signOut();
      // Don't redirect here, just render the auth layout
    } else if (user && !error && user.email_confirmed_at) {
      // Only redirect if we have a valid user and no error
      redirect('/dashboard');
    }
  } catch (error) {
    console.error('Authentication error in auth layout:', error);
    // Continue to render auth layout on error
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
