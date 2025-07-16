import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Sign out the user to clear all session data
    await supabase.auth.signOut();

    return NextResponse.json(
      {
        message: 'Session cleared successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json(
      {
        message: 'Session cleared',
      },
      { status: 200 }
    ); // Return success even on error to ensure cleanup
  }
}
