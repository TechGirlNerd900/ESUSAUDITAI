#!/usr/bin/env node

/**
 * Test database connection directly
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log('Testing database connection...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test basic connection
    const { data, error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      console.error('Database connection error:', error);
      return false;
    }

    console.log('✅ Database connection successful');
    console.log('Organizations table accessible:', data);

    // Test creating an organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert([{ name: 'Test Organization Connection' }])
      .select()
      .single();

    if (orgError) {
      console.error('Organization creation error:', orgError);
      return false;
    }

    console.log('✅ Organization creation successful:', orgData);

    // Test creating a user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          auth_user_id: '123e4567-e89b-12d3-a456-426614174000',
          organization_id: orgData.id,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'admin',
          status: 'active',
          is_active: true,
        },
      ])
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return false;
    }

    console.log('✅ User creation successful:', userData);

    // Clean up
    await supabase.from('users').delete().eq('id', userData.id);
    await supabase.from('organizations').delete().eq('id', orgData.id);

    console.log('✅ Cleanup successful');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

testConnection().then((success) => {
  console.log(success ? '✅ All tests passed' : '❌ Tests failed');
  process.exit(success ? 0 : 1);
});
