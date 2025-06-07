const express = require('express');
const router = express.Router();
const { supabase } = require('../shared/supabaseClient');

const AuthService = require('../shared/auth');
const SecurityService = require('../shared/security');
const { applicationInsights } = require('../shared/logging');

const auth = new AuthService();
const security = new SecurityService();

// Apply rate limiting to auth routes
const authRateLimit = security.createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

// User registration
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, company, role } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
        }
        
        // Validate role if provided
        const validRoles = ['auditor', 'reviewer', 'admin'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        // Use centralized validation methods
        if (!security.validateInput(email, 'email')) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Use centralized validation methods
        if (!security.validateInput(password, 'password')) {
            return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
        }

        // Register user with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });

        if (error) throw error;

        // Create user record in database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([{
                id: data.user.id,
                email,
                first_name: firstName,
                last_name: lastName,
                role: role || 'auditor', // Use provided role or default to 'auditor'
                company
            }])
            .select()
            .single();

        if (userError) throw userError;

        applicationInsights.trackEvent({
            name: 'UserRegistered',
            properties: { userId: userData.id }
        });

        res.status(201).json({
            user: auth.sanitizeUser(userData),
            token: data.session?.access_token
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        console.error('Registration error:', error);
        
        // Handle Supabase specific errors
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        // Handle other known error types
        if (error.message && error.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// User login
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!security.validateInput(email, 'email')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check for account lockout
    const lockoutStatus = await security.checkLoginAttempts(email);
    if (!lockoutStatus.allowed) {
      return res.status(429).json({
        error: 'Account temporarily locked',
        lockoutTimeRemaining: lockoutStatus.lockoutTimeRemaining
      });
    }

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      await security.recordFailedLogin(email);
      applicationInsights.trackEvent({
        name: 'LoginFailed',
        properties: { email, reason: error.message }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Clear failed login attempts on success
    await security.clearLoginAttempts(email);

    // Get additional user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) throw userError;

    applicationInsights.trackEvent({
      name: 'LoginSuccessful',
      properties: { userId: userData.id }
    });

    res.json({
      user: auth.sanitizeUser(userData),
      token: data.session.access_token
    });
  } catch (error) {
    applicationInsights.trackException({ exception: error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token and get user info
router.get('/verify', async (req, res) => {
  try {
    const userData = await auth.authenticateRequest(req);
    res.json({ user: userData });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    applicationInsights.trackException({ exception: error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
