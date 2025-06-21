// Fix Admin Access Script
// This script fixes issues with admin access by ensuring that:
// 1. All auth.users have corresponding entries in the public.users table
// 2. Admin roles are properly assigned and propagated
// 3. Organization relationships are correctly established

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

// Load environment variables from root directory
if (fs.existsSync('.env')) {
  dotenv.config()
} else if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' })
} else if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' })
} else {
  console.error('No environment file found (.env, .env.production, or .env.local)')
  process.exit(1)
}

// Create a Supabase client with admin permissions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Function to fix auth-profile connections
async function fixAuthProfiles() {
  console.log('Checking for auth users without profiles...')
  
  // Get all auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error fetching auth users:', authError)
    return
  }
  
  console.log(`Found ${authUsers.users.length} auth users.`)
  
  // Get all profiles
  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('*')
  
  if (profileError) {
    console.error('Error fetching profiles:', profileError)
    return
  }
  
  console.log(`Found ${profiles?.length || 0} user profiles.`)
  
  // Find auth users without profiles
  const profileMap = new Map()
  profiles?.forEach(profile => {
    profileMap.set(profile.auth_user_id, profile)
  })
  
  let fixedCount = 0
  
  // Process each auth user
  for (const user of authUsers.users) {
    const profile = profileMap.get(user.id)
    
    if (!profile) {
      console.log(`User ${user.email} (${user.id}) has no profile. Creating one...`)
      
      try {
        // Create a profile for this user
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert([{
            auth_user_id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || user.email.split('@')[0],
            last_name: user.user_metadata?.last_name || 'User',
            role: user.user_metadata?.role || 'auditor',
            organization_id: user.user_metadata?.organization_id || null,
            is_active: true,
            status: 'active'
          }])
          .select()
          .single()
          
        if (createError) {
          console.error(`Failed to create profile for ${user.email}:`, createError)
        } else {
          console.log(`Created profile for ${user.email} with role ${newProfile.role}`)
          fixedCount++
        }
      } catch (err) {
        console.error(`Error creating profile for ${user.email}:`, err)
      }
    } else {
      // Profile exists, but check if the role is correctly set
      const authRole = user.user_metadata?.role
      const profileRole = profile.role
      
      if (authRole && authRole !== profileRole) {
        console.log(`Role mismatch for ${user.email}: Auth role: ${authRole}, Profile role: ${profileRole}. Fixing...`)
        
        try {
          // Update the profile role to match auth role
          const { error: updateError } = await supabase
            .from('users')
            .update({ role: authRole })
            .eq('id', profile.id)
            
          if (updateError) {
            console.error(`Failed to update role for ${user.email}:`, updateError)
          } else {
            console.log(`Updated role for ${user.email} to ${authRole}`)
            fixedCount++
          }
        } catch (err) {
          console.error(`Error updating role for ${user.email}:`, err)
        }
      }
      
      // Check if the profile is active
      if (!profile.is_active || profile.status !== 'active') {
        console.log(`User ${user.email} has an inactive profile. Activating...`)
        
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({ is_active: true, status: 'active' })
            .eq('id', profile.id)
            
          if (updateError) {
            console.error(`Failed to activate profile for ${user.email}:`, updateError)
          } else {
            console.log(`Activated profile for ${user.email}`)
            fixedCount++
          }
        } catch (err) {
          console.error(`Error activating profile for ${user.email}:`, err)
        }
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} user profile issues.`)
}

// Function to ensure default organization exists
async function ensureDefaultOrganization() {
  console.log('Checking for default organization...')
  
  // Check if any organization exists
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    
  if (orgError) {
    console.error('Error checking organizations:', orgError)
    return null
  }
  
  // If no organization exists, create a default one
  if (!orgs || orgs.length === 0) {
    console.log('No organizations found. Creating default organization...')
    
    try {
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: 'Default Organization'
        }])
        .select()
        .single()
        
      if (createError) {
        console.error('Failed to create default organization:', createError)
        return null
      }
      
      console.log(`Created default organization with ID ${newOrg.id}`)
      return newOrg.id
    } catch (err) {
      console.error('Error creating default organization:', err)
      return null
    }
  } else {
    console.log(`Found existing organization: ${orgs[0].name} (${orgs[0].id})`)
    return orgs[0].id
  }
}

// Function to ensure admin user exists
async function ensureAdminUser(defaultOrgId) {
  console.log('Checking for admin users...')
  
  // Check if any admin users exist in the profiles
  const { data: admins, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .is('deleted_at', null)
    
  if (adminError) {
    console.error('Error checking admin users:', adminError)
    return
  }
  
  // If no admin users exist, check if we can promote an existing user
  if (!admins || admins.length === 0) {
    console.log('No admin users found. Looking for users to promote...')
    
    // Get the first active user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      
    if (userError) {
      console.error('Error checking users:', userError)
      return
    }
    
    if (users && users.length > 0) {
      console.log(`Found user ${users[0].email} to promote to admin.`)
      
      try {
        // Promote the user to admin
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            role: 'admin',
            organization_id: defaultOrgId 
          })
          .eq('id', users[0].id)
          
        if (updateError) {
          console.error(`Failed to promote user to admin:`, updateError)
        } else {
          console.log(`Promoted ${users[0].email} to admin role.`)
          
          // Also update the auth user's metadata
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
            users[0].auth_user_id,
            { 
              user_metadata: { 
                role: 'admin',
                organization_id: defaultOrgId
              } 
            }
          )
          
          if (authUpdateError) {
            console.error(`Failed to update auth user metadata:`, authUpdateError)
          } else {
            console.log(`Updated auth metadata for ${users[0].email}`)
          }
        }
      } catch (err) {
        console.error(`Error promoting user to admin:`, err)
      }
    } else {
      console.log('No users found to promote. You may need to create an admin user manually.')
    }
  } else {
    console.log(`Found ${admins.length} admin users.`)
    
    // Make sure all admin users have an organization assigned
    for (const admin of admins) {
      if (!admin.organization_id) {
        console.log(`Admin user ${admin.email} has no organization. Assigning to default...`)
        
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({ organization_id: defaultOrgId })
            .eq('id', admin.id)
            
          if (updateError) {
            console.error(`Failed to assign organization to admin:`, updateError)
          } else {
            console.log(`Assigned organization to ${admin.email}`)
          }
        } catch (err) {
          console.error(`Error assigning organization:`, err)
        }
      }
    }
  }
}

// Main function to run all fixes
async function main() {
  console.log('Starting admin access fix...')
  
  // First ensure we have a default organization
  const defaultOrgId = await ensureDefaultOrganization()
  
  if (!defaultOrgId) {
    console.error('Failed to ensure default organization. Aborting.')
    return
  }
  
  // Fix auth-profile connections
  await fixAuthProfiles()
  
  // Ensure admin user exists
  await ensureAdminUser(defaultOrgId)
  
  console.log('Admin access fix completed.')
}

// Run the main function
main()
  .catch(err => {
    console.error('Error in admin access fix:', err)
    process.exit(1)
  })