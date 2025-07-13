const fetch = require('node-fetch');

async function testSignupFix() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log('Testing signup fix...');
  
  // Test data
  const testData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    organizationName: 'Test Organization',
    registrationType: 'create_org'
  };
  
  try {
    console.log('Attempting signup with data:', {
      ...testData,
      password: '[REDACTED]'
    });
    
    const response = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Signup test PASSED - No foreign key constraint violation');
      try {
        const data = JSON.parse(responseText);
        console.log('User created successfully:', data.user?.email);
        console.log('User ID:', data.user?.id);
        console.log('Organization ID:', data.user?.organization_id);
      } catch (e) {
        console.log('Response was successful but not JSON');
        console.log('Response:', responseText);
      }
    } else {
      console.log('❌ Signup test FAILED');
      console.log('Error response:', responseText);
      
      // Check if it's still the same foreign key error
      if (responseText.includes('audit_logs_user_id_fkey')) {
        console.log('🔴 STILL SAME ERROR: Foreign key constraint violation on audit_logs');
      } else if (responseText.includes('violates foreign key constraint')) {
        console.log('🟡 DIFFERENT FK ERROR: Different foreign key constraint violation');
      } else {
        console.log('🟢 DIFFERENT ERROR: Not a foreign key constraint issue - fix worked!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with network error:', error.message);
  }
}

testSignupFix();
