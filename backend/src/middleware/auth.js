import { getFirebaseAdmin } from '../services/firebaseAdmin.js';

/**
 * Express middleware that verifies a Firebase ID token from the
 * `Authorization: Bearer <token>` header and attaches the decoded user
 * to `req.user`.
 *
 * Returns 401 when the header is missing, malformed, or the token is
 * invalid/expired.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: 'Missing or malformed Authorization header. Expected: Bearer <token>.',
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      emailVerified: decoded.email_verified || false,
      name: decoded.name || null,
      picture: decoded.picture || null,
    };
    return next();
  } catch (err) {
    console.warn('[auth] token verification failed:', err.code || err.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
    });
  }
}
