// Script to create missing user profiles for existing auth users
// Run this once to fix users who were created before profile creation was implemented

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMissingProfiles() {
  try {
    console.log('🔍 Fetching all auth users...');

    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users`);

    // Get existing profile user IDs
    const { data: existingProfiles, error: profileError } = await supabase
      .from('users')
      .select('auth_user_id');

    if (profileError) {
      console.error('❌ Error fetching existing profiles:', profileError);
      return;
    }

    const existingProfileIds = new Set(existingProfiles.map((p) => p.auth_user_id));
    console.log(`📊 Found ${existingProfiles.length} existing profiles`);

    // Find users without profiles
    const usersWithoutProfiles = authUsers.users.filter(
      (user) => !existingProfileIds.has(user.id) && user.email_confirmed_at
    );

    console.log(`🔧 Found ${usersWithoutProfiles.length} users without profiles`);

    if (usersWithoutProfiles.length === 0) {
      console.log('✅ All users already have profiles');
      return;
    }

    // Create default organization if needed
    let defaultOrg = null;
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);

    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }

    if (orgs.length === 0) {
      console.log('🏢 Creating default organization...');
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Default Organization',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createOrgError) {
        console.error('❌ Error creating default organization:', createOrgError);
        return;
      }
      defaultOrg = newOrg;
    } else {
      defaultOrg = orgs[0];
    }

    console.log(`🏢 Using organization: ${defaultOrg.name} (${defaultOrg.id})`);

    // Create profiles for users without them
    const profilesToCreate = usersWithoutProfiles.map((user) => {
      const metadata = user.user_metadata || {};
      return {
        auth_user_id: user.id,
        email: user.email,
        first_name: metadata.first_name || metadata.firstName || 'Unknown',
        last_name: metadata.last_name || metadata.lastName || 'User',
        role: metadata.role || 'auditor',
        organization_id: metadata.organization_id || defaultOrg.id,
        status: 'active',
        is_active: true,
        created_at: user.created_at,
        updated_at: new Date().toISOString(),
      };
    });

    console.log('👤 Creating missing profiles...');
    const { data: createdProfiles, error: createError } = await supabase
      .from('users')
      .insert(profilesToCreate)
      .select();

    if (createError) {
      console.error('❌ Error creating profiles:', createError);
      return;
    }

    console.log(`✅ Successfully created ${createdProfiles.length} user profiles`);

    // Log the created profiles
    createdProfiles.forEach((profile) => {
      console.log(`   - ${profile.first_name} ${profile.last_name} (${profile.email})`);
    });
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the script
createMissingProfiles()
  .then(() => {
    console.log('🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
