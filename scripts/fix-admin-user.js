// Fix Admin User Script
// Repairs or creates admin user

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import readline from 'readline'
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

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Function to prompt for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function main() {
  console.log('\n🔧 Admin User Fix Tool 🔧\n')
  console.log('This tool will help fix admin access issues by:')
  console.log('1. Creating a new admin user')
  console.log('2. Fixing an existing user\'s admin permissions')
  console.log('3. Resetting an admin user\'s password\n')
  
  const action = await prompt('Select action (1-3): ')
  
  if (action === '1') {
    // Create new admin user
    await createAdminUser()
  } else if (action === '2') {
    // Fix existing user
    await fixExistingUser()
  } else if (action === '3') {
    // Reset password
    await resetPassword()
  } else {
    console.log('Invalid action selected.')
  }
  
  rl.close()
}

async function createAdminUser() {
  console.log('\n📝 Create New Admin User')
  
  const email = await prompt('Enter email: ')
  const password = await prompt('Enter password: ')
  const firstName = await prompt('Enter first name: ')
  const lastName = await prompt('Enter last name: ')
  
  // Create organization if needed
  const organizationId = await getOrCreateOrganization()
  
  // Create user in auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
      organization_id: organizationId
    }
  })
  
  if (authError) {
    console.error('Error creating auth user:', authError)
    return
  }
  
  console.log(`✅ Created auth user: ${authData.user.id}`)
  
  // Create profile
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .insert([{
      auth_user_id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
      organization_id: organizationId,
      is_active: true,
      status: 'active'
    }])
    .select()
    .single()
    
  if (profileError) {
    console.error('Error creating user profile:', profileError)
    return
  }
  
  console.log(`✅ Created user profile: ${profileData.id}`)
  console.log(`\n🎉 Admin user ${email} created successfully!`)
  console.log(`You can now log in with this account.`)
}

async function fixExistingUser() {
  console.log('\n🔍 Fix Existing User')
  
  const email = await prompt('Enter user\'s email: ')
  
  // Get auth user
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error listing users:', authError)
    return
  }
  
  const authUser = users.find(u => u.email === email)
  
  if (!authUser) {
    console.log(`❌ User with email ${email} not found in auth system.`)
    return
  }
  
  console.log(`Found auth user: ${authUser.id}`)
  
  // Get organization
  const organizationId = await getOrCreateOrganization()
  
  // Update auth user metadata
  const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
    authUser.id,
    { 
      user_metadata: { 
        ...authUser.user_metadata,
        role: 'admin',
        organization_id: organizationId
      } 
    }
  )
  
  if (updateAuthError) {
    console.error('Error updating auth user:', updateAuthError)
  } else {
    console.log('✅ Updated auth user metadata')
  }
  
  // Check for profile
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single()
    
  if (profileError) {
    // Profile doesn't exist, create it
    console.log('User profile not found, creating...')
    
    const { data: newProfile, error: createError } = await supabase
      .from('users')
      .insert([{
        auth_user_id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || 'Admin',
        last_name: authUser.user_metadata?.last_name || 'User',
        role: 'admin',
        organization_id: organizationId,
        is_active: true,
        status: 'active'
      }])
      .select()
      .single()
      
    if (createError) {
      console.error('Error creating profile:', createError)
      return
    }
    
    console.log(`✅ Created user profile: ${newProfile.id}`)
  } else {
    // Update existing profile
    const { error: updateError } = await supabase
      .from('users')
      .update({
        role: 'admin',
        organization_id: organizationId,
        is_active: true,
        status: 'active',
        deleted_at: null
      })
      .eq('id', profileData.id)
      
    if (updateError) {
      console.error('Error updating profile:', updateError)
      return
    }
    
    console.log(`✅ Updated user profile: ${profileData.id}`)
  }
  
  console.log(`\n🎉 User ${email} has been granted admin access!`)
}

async function resetPassword() {
  console.log('\n🔑 Reset Admin Password')
  
  const email = await prompt('Enter admin email: ')
  const newPassword = await prompt('Enter new password: ')
  
  // Validate password
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  if (!passwordRegex.test(newPassword)) {
    console.log('❌ Password must be at least 8 characters and include uppercase, lowercase, number, and special character')
    return
  }
  
  // Get user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }
  
  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.log(`❌ User with email ${email} not found.`)
    return
  }
  
  // Reset password
  const { error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  )
  
  if (error) {
    console.error('Error resetting password:', error)
    return
  }
  
  console.log(`✅ Password reset successfully for ${email}`)
}

async function getOrCreateOrganization() {
  // Check if any organization exists
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    
  if (orgError) {
    console.error('Error fetching organizations:', orgError)
    return null
  }
  
  if (orgs && orgs.length > 0) {
    // List organizations for selection
    console.log('\nAvailable organizations:')
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.id})`)
    })
    
    const selection = await prompt('Select organization (number) or "n" for new: ')
    
    if (selection.toLowerCase() === 'n') {
      return await createNewOrganization()
    }
    
    const index = parseInt(selection) - 1
    if (isNaN(index) || index < 0 || index >= orgs.length) {
      console.log('Invalid selection. Using the first organization.')
      return orgs[0].id
    }
    
    return orgs[index].id
  } else {
    // No organizations, create one
    return await createNewOrganization()
  }
}

async function createNewOrganization() {
  const name = await prompt('Enter organization name: ')
  
  const { data: org, error } = await supabase
    .from('organizations')
    .insert([{ name }])
    .select()
    .single()
    
  if (error) {
    console.error('Error creating organization:', error)
    return null
  }
  
  console.log(`✅ Created organization: ${org.name} (${org.id})`)
  return org.id
}

// Run the main function
main().catch(err => {
  console.error('Error:', err)
  rl.close()
})