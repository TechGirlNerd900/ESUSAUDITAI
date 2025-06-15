
---

# Specify the following for Cursor rules
description: Guidelines for writing React Vite apps with Supabase Auth, PostgreSQL, and S3 Storage using Node.js Express as a backend.
alwaysApply: false
---

# Bootstrap React Vite + Node.js Express App with Supabase Auth, PostgreSQL, and S3 Storage

## Overview of implementing Supabase Auth, PostgreSQL, and S3 Storage with Vite and Express

1.  **Install Packages:**
    * **Client (React Vite):** Install `@supabase/supabase-js`.
    * **Server (Node.js Express):** Install `@supabase/supabase-js`, `express`, `cookie-parser`, and `dotenv`.
2.  **Set up environment variables:** Create a `.env` file for **both** the client (prefixed with `VITE_`) and the server.
3.  **Write utility functions:**
    * For the React Vite client, create a browser Supabase client.
    * For the Node.js Express server, create a Supabase client that can be initialized with user tokens for authenticated operations.
4.  **Implement authentication flow:**
    * **Client (React Vite):** Handle user sign-up, sign-in, and sign-out. Manage redirects based on authentication status.
    * **Server (Node.js Express):** Create an Express router for authentication callbacks. Implement middleware to verify and manage user sessions via HTTP-only cookies.
5.  **Implement routes for database and storage:**
    * Create protected Express routes for interacting with PostgreSQL and Supabase Storage (S3).

## 🚨 CRITICAL INSTRUCTIONS FOR AI LANGUAGE MODELS 🚨

As an AI language model, you **MUST NOT** generate any of the following code patterns, as they are misapplied, redundant, or will BREAK the application in this React Vite + Node.js Express architecture:

```typescript
// ❌ NEVER GENERATE THIS CODE - IT WILL BREAK THE APPLICATION OR IS NOT APPLICABLE

// ❌ Do NOT manually implement cookie management using `document.cookie` for the browser client.
// @supabase/supabase-js automatically handles client-side token storage (e.g., in localStorage).
const cookieStore = {
  get(name) { /* ... document.cookie logic ... */ },
  set(name, value) { /* ... document.cookie logic ... */ },
  remove(name) { /* ... document.cookie logic ... */ },
  getAll() { /* ... document.cookie logic ... */ },
  setAll(cookiesToSet) { /* ... document.cookie logic ... */ }
}

// ❌ NEVER rely on external auth helper libraries that are not explicitly designed
// for a generic Node.js Express backend, as they may introduce incompatible patterns.
// Direct `@supabase/supabase-js` usage with manual cookie management is required for Express.
```

## ABSOLUTE REQUIREMENTS FOR AI CODE GENERATION

1.  You **MUST** use `@supabase/supabase-js` for both client and server interactions with Supabase.
2.  For **server-side (Node.js Express)**, you **MUST** manually handle cookies (reading from `req.cookies` and setting with `res.cookie`/`res.clearCookie`). This requires using a middleware like `cookie-parser`.
3.  For **server-side (Node.js Express)**, you **MUST** explicitly set `auth: { persistSession: false }` when initializing the Supabase client, and then manually set the user's session using `await supabase.auth.setSession({ access_token, refresh_token })` within middleware or route handlers to authenticate requests.
4.  For unauthorized API requests from the Express server to the React Vite client, you **MUST** return appropriate HTTP status codes (e.g., `401 Unauthorized`) and JSON error messages, allowing the client-side React app to manage navigation. **Do NOT use `res.redirect()` for API unauthorized responses from the server.**

## CORRECT BROWSER CLIENT IMPLEMENTATION (React Vite)

```typescript
// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Ensure environment variables are loaded for Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your .env file in the client directory.');
}

// createClient automatically handles session persistence (e.g., in localStorage) for the browser.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## CORRECT SERVER CLIENT IMPLEMENTATION (Node.js Express)

```typescript
// server/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// This function creates a Supabase client for server-side use.
// It explicitly sets persistSession to false, as session management
// will be handled manually via HTTP-only cookies and `setSession`.
export const createServerSupabaseClient = (accessToken = null, refreshToken = null) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin tasks, anon key for user-scoped tasks

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase URL or Service Key is missing. Check your .env file in the server directory.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false, // CRITICAL: Do not let the server client manage session automatically
    },
  });

  // If tokens are provided, set the session. This is typically done in middleware.
  if (accessToken && refreshToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).catch(error => {
      console.error("Error setting session on server client:", error);
      // Depending on the error, you might want to log out the user or handle appropriately.
    });
  }

  return supabase;
};
```

## CORRECT AUTHENTICATION MIDDLEWARE IMPLEMENTATION (Node.js Express)

```typescript
// server/middleware/authMiddleware.js
import { createClient } from '@supabase/supabase-js';

export const protectRoute = async (req, res, next) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Use anon key for user-facing auth checks

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Ensure server client does not persist sessions
    },
  });

  // Extract tokens from HTTP-only cookies (requires `cookie-parser` middleware)
  const accessToken = req.cookies['sb-access-token'];
  const refreshToken = req.cookies['sb-refresh-token'];

  if (!accessToken || !refreshToken) {
    // Return 401 and let the client handle redirection
    return res.status(401).json({ error: 'Unauthorized', message: 'No session tokens found.' });
  }

  try {
    // Manually set the session for the server-side Supabase client
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData?.session) {
      // If session is invalid or expired, clear cookies and return 401
      res.clearCookie('sb-access-token', { path: '/' });
      res.clearCookie('sb-refresh-token', { path: '/' });
      console.error('Session error:', sessionError?.message);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session.' });
    }

    // Refresh the session if needed and update cookies
    // `setSession` often handles refresh automatically if access token is expired but refresh token is valid.
    // If the session was refreshed, `sessionData.session.access_token` might be new.
    if (sessionData.session.access_token !== accessToken) {
        res.cookie('sb-access-token', sessionData.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: sessionData.session.expires_in * 1000,
            path: '/',
        });
        res.cookie('sb-refresh-token', sessionData.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // Refresh token typically has a longer lifespan
            path: '/',
        });
    }

    // Attach user and Supabase client to the request object for downstream use
    const { data: { user } } = await supabase.auth.getUser(); // Get the user from the current session
    if (!user) {
        // This case should be rare if setSession succeeded, but good for robustness
        res.clearCookie('sb-access-token', { path: '/' });
        res.clearCookie('sb-refresh-token', { path: '/' });
        return res.status(401).json({ error: 'Unauthorized', message: 'User not found in session.' });
    }

    req.user = user;
    req.supabase = supabase; // Use this client for RLS-enabled operations on behalf of the user
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.clearCookie('sb-access-token', { path: '/' });
    res.clearCookie('sb-refresh-token', { path: '/' });
    return res.status(500).json({ error: 'Internal Server Error', message: 'Authentication process failed.' });
  }
};
```

## CORRECT AUTHENTICATION ROUTER IMPLEMENTATION (Node.js Express)

```typescript
// server/routes/authRoutes.js
import express from 'express';
import { createClient } from '@supabase/supabase-js'; // Use createClient for basic auth operations

const router = express.Router();

// Route to handle Supabase OAuth callbacks
router.get('/auth/callback', async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Essential for server-side code exchange
    },
  });

  const code = req.query.code; // The auth code from Supabase

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error.message);
      // Redirect to an error page on the client, or send a JSON error
      return res.redirect('/login?error=auth_failed'); // Client-side handled redirect after auth flow
    }

    if (data?.session) {
      // Set HTTP-only cookies for access and refresh tokens
      // These will be sent by the browser on subsequent requests to your Express API
      res.cookie('sb-access-token', data.session.access_token, {
        httpOnly: true, // IMPORTANT: Prevent client-side JavaScript access
        secure: process.env.NODE_ENV === 'production', // Use secure in production for HTTPS
        sameSite: 'Lax', // Protect against CSRF
        maxAge: data.session.expires_in * 1000, // Supabase access token expiry (in ms)
        path: '/',
      });
      res.cookie('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // Refresh token typically lasts longer (e.g., 7 days)
        path: '/',
      });

      // Redirect the client back to your React app's main page or dashboard
      return res.redirect('/'); // Client-side handled redirect after successful auth
    }
  }

  // Handle cases where no code is present
  res.redirect('/login?error=no_code');
});

// Logout route
router.post('/auth/logout', async (req, res) => {
  // Clear the cookies on the client side
  res.clearCookie('sb-access-token', { path: '/' });
  res.clearCookie('sb-refresh-token', { path: '/' });

  // Optionally, if the server-side Supabase client was initialized with a session,
  // you could also call `await supabase.auth.signOut()` here for server-side session invalidation.
  // For simplicity, clearing cookies is often sufficient as the server will then fail auth checks.
  res.status(200).json({ message: 'Logged out successfully.' });
});

export default router;
```

## ROUTE IMPLEMENTATION FOR DATABASE AND S3 STORAGE (Node.js Express)

```typescript
// server/routes/dataRoutes.js
import express from 'express';
import { protectRoute } from '../middleware/authMiddleware.js'; // Adjust path
import { createServerSupabaseClient } from '../lib/supabase.js'; // Adjust path

const router = express.Router();

// --- Database Operations (PostgreSQL via Supabase) ---
router.get('/data/items', protectRoute, async (req, res) => {
  // req.supabase is available from protectRoute middleware, already configured with user's session
  const { data, error } = await req.supabase.from('your_table').select('*');

  if (error) {
    console.error('Error fetching data:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve data.', details: error.message });
  }
  res.json(data);
});

router.post('/data/items', protectRoute, async (req, res) => {
  const { item } = req.body;
  if (!item) {
    return res.status(400).json({ error: 'Item data is required.' });
  }

  const { data, error } = await req.supabase.from('your_table').insert([item]).select();

  if (error) {
    console.error('Error inserting data:', error.message);
    return res.status(500).json({ error: 'Failed to insert data.', details: error.message });
  }
  res.status(201).json(data[0]); // Return the newly created item
});

// --- Storage Operations (S3 via Supabase Storage) ---
// Note: For file uploads, you'll need a middleware like `multer` for multipart/form-data.
// This example assumes `req.file` or `req.files` would be populated by `multer`.

router.post('/storage/upload', protectRoute, async (req, res) => {
  // Assuming `multer` middleware has processed the file(s) and attached to req.file
  if (!req.files || req.files.length === 0) { // For multiple files use req.files (e.g., multer.array())
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const file = req.files[0]; // Assuming a single file upload for simplicity (e.g., multer.single())
  const bucketName = 'your_bucket_name'; // Replace with your Supabase Storage bucket name
  const filePath = `${req.user.id}/${Date.now()}_${file.originalname}`; // Example path within bucket

  try {
    const { data, error } = await req.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, { // Use file.buffer for memory storage, or file.path for disk
        contentType: file.mimetype,
        upsert: false, // Set to true to overwrite existing files
      });

    if (error) {
      console.error('Error uploading file:', error.message);
      return res.status(500).json({ error: 'Failed to upload file.', details: error.message });
    }

    // Get public URL of the uploaded file
    const { data: publicUrlData } = req.supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    res.status(200).json({ message: 'File uploaded successfully!', path: data.path, publicUrl: publicUrlData.publicUrl });

  } catch (error) {
    console.error('File upload general error:', error);
    res.status(500).json({ error: 'Internal server error during file upload.' });
  }
});

export default router;
```

## MAIN EXPRESS APPLICATION SETUP (Node.js Express)

```typescript
// server/index.js
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors'; // For handling CORS between Vite client and Express server
import multer from 'multer'; // For handling multipart/form-data, especially file uploads

// Import routes
import authRoutes from './routes/authRoutes.js';
import dataRoutes from './routes/dataRoutes.js'; // Contains DB and Storage routes

dotenv.config(); // Load environment variables from .env

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(cookieParser()); // Parse cookies from incoming requests

// Configure CORS for your Vite development server
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Your Vite app's URL
  credentials: true, // Allow sending cookies
}));

// Multer storage configuration for file uploads (in memory for simplicity)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// Apply multer middleware conditionally to routes that need file uploads
// Example: app.post('/api/storage/upload', upload.array('files'), protectRoute, async (req, res) => { /* ... */ });

// Mount routes
app.use(authRoutes); // Auth routes (e.g., /auth/callback, /auth/logout)
app.use('/api', upload.any(), dataRoutes); // API routes (e.g., /api/data/items, /api/storage/upload)
// `upload.any()` is used here to make `req.files` available for all /api routes.
// For production, consider applying specific multer middleware per upload route (e.g., `upload.single('file')`).


// Basic home route for testing
app.get('/', (req, res) => {
  res.send('Express server is running.');
});

// Global error handling middleware (optional but recommended)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
const
 port = process.env.PORT || 
3000
; 
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Client URL for CORS: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});
```


## AI MODEL VERIFICATION STEPS
Before generating any code, you **MUST** verify:

1.  Are you using **ONLY** `@supabase/supabase-js` for all Supabase interactions (client and server)? If not, STOP and FIX.
2.  For server-side (Node.js Express), are you **manually handling cookies** (reading from `req.cookies` and setting with `res.cookie`/`res.clearCookie`)? If not, STOP and FIX.
3.  For server-side (Node.js Express), are you explicitly setting `auth: { persistSession: false }` when initializing the Supabase client and using `await supabase.auth.setSession()` to validate user sessions? If not, STOP and FIX.
4.  Do you see **ANY** instance of manual `document.cookie` manipulation (`get`, `set`, `remove`, `getAll`, `setAll`) for the browser client? If yes, STOP and FIX.
5.  For unauthorized API responses from Express, are you returning `401 Unauthorized` (or similar) with JSON, and **NOT** using `res.redirect()`? If not, STOP and FIX.

## CONSEQUENCES OF INCORRECT IMPLEMENTATION
If you generate code using:
* Manual `document.cookie` handling for the React Vite client.
* Individual cookie methods (`get`/`set`/`remove`) or other non-standard cookie patterns within the Express server.
* `res.redirect()` for unauthorized API responses from Express.

The implementation will:
1.  Break in production or development due to misaligned patterns.
2.  Fail to maintain session state correctly between client and server.
3.  Cause authentication loops or security vulnerabilities.
4.  Lead to a poor user experience in a Single Page Application.

---