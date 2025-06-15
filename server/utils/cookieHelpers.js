import logger from '../shared/logger.js';

/**
 * Cookie helper utilities for Supabase authentication tokens
 * Following Supabase SSR patterns for consistent cookie management
 */

/**
 * Standard cookie options for Supabase auth tokens
 * @param {boolean} isProduction - Whether app is in production mode
 * @param {number} maxAge - Cookie expiration time in milliseconds
 * @returns {Object} Cookie options
 */
export const getAuthCookieOptions = (isProduction = process.env.NODE_ENV === 'production', maxAge = null) => ({
    httpOnly: true, // Prevent client-side JavaScript access for security
    secure: isProduction, // Use secure cookies in production (HTTPS)
    sameSite: 'Lax', // Protect against CSRF while allowing normal navigation
    path: '/', // Available across the entire app
    ...(maxAge && { maxAge }) // Add maxAge only if provided
});

/**
 * Set Supabase authentication tokens as HTTP-only cookies
 * @param {Response} res - Express response object
 * @param {Object} session - Supabase session object
 * @param {Object} options - Optional overrides for cookie settings
 */
export const setAuthTokens = (res, session, options = {}) => {
    if (!session?.access_token || !session?.refresh_token) {
        logger.error('Attempted to set auth cookies with invalid session', {
            hasAccessToken: !!session?.access_token,
            hasRefreshToken: !!session?.refresh_token,
            sessionKeys: session ? Object.keys(session) : 'null'
        });
        throw new Error('Invalid session: missing access_token or refresh_token');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    
    // Access token cookie - expires with the token
    const accessTokenMaxAge = session.expires_in ? session.expires_in * 1000 : 60 * 60 * 1000; // Default 1 hour
    res.cookie('sb-access-token', session.access_token, {
        ...getAuthCookieOptions(isProduction, accessTokenMaxAge),
        ...options.accessToken
    });

    // Refresh token cookie - longer expiration (typically 7 days)
    const refreshTokenMaxAge = options.refreshTokenMaxAge || 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie('sb-refresh-token', session.refresh_token, {
        ...getAuthCookieOptions(isProduction, refreshTokenMaxAge),
        ...options.refreshToken
    });

    logger.debug('Auth tokens set as cookies', {
        hasAccessToken: true,
        hasRefreshToken: true,
        accessTokenExpiry: new Date(Date.now() + accessTokenMaxAge).toISOString(),
        refreshTokenExpiry: new Date(Date.now() + refreshTokenMaxAge).toISOString()
    });
};

/**
 * Clear Supabase authentication cookies
 * @param {Response} res - Express response object
 */
export const clearAuthTokens = (res) => {
    const cookieOptions = { path: '/' };
    
    res.clearCookie('sb-access-token', cookieOptions);
    res.clearCookie('sb-refresh-token', cookieOptions);
    
    logger.debug('Auth tokens cleared from cookies');
};

/**
 * Extract Supabase tokens from request cookies
 * @param {Request} req - Express request object
 * @returns {Object} Object containing access_token and refresh_token
 */
export const getAuthTokensFromCookies = (req) => {
    const accessToken = req.cookies['sb-access-token'];
    const refreshToken = req.cookies['sb-refresh-token'];
    
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        hasTokens: !!(accessToken && refreshToken)
    };
};

/**
 * Validate that both tokens are present
 * @param {Request} req - Express request object
 * @returns {boolean} True if both tokens are present
 */
export const hasValidTokenCookies = (req) => {
    const { hasTokens } = getAuthTokensFromCookies(req);
    return hasTokens;
};

/**
 * Refresh and update auth cookies if session was refreshed
 * Used in middleware when tokens are automatically refreshed
 * @param {Response} res - Express response object
 * @param {Object} oldSession - Previous session object
 * @param {Object} newSession - New session object from refresh
 */
export const updateRefreshedTokens = (res, oldSession, newSession) => {
    // Only update cookies if tokens actually changed
    if (newSession.access_token !== oldSession.access_token) {
        setAuthTokens(res, newSession);
        
        logger.info('Auth tokens refreshed and updated in cookies', {
            oldAccessTokenPrefix: oldSession.access_token?.substring(0, 20) + '...',
            newAccessTokenPrefix: newSession.access_token?.substring(0, 20) + '...'
        });
        
        return true;
    }
    
    return false;
};

export default {
    setAuthTokens,
    clearAuthTokens,
    getAuthTokensFromCookies,
    hasValidTokenCookies,
    updateRefreshedTokens,
    getAuthCookieOptions
};