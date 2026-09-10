import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  User,
  AuthError,
} from 'firebase/auth';
import { auth } from './firebase';
import { isBlockedEmailDomain } from './blockedEmailDomains';

/**
 * Standardized client-facing auth error messages
 */
function formatAuthError(error: any): string {
  const code = (error as AuthError)?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in.';
    case 'auth/invalid-email':
      return 'Please provide a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    default:
      return error?.message || 'An authentication error occurred. Please try again.';
  }
}

/**
 * Registers a new user account with strict disposable domain validation
 * and sends an email verification link.
 */
export async function signUp(email: string, password: string): Promise<User> {
  const trimmedEmail = (email || '').trim().toLowerCase();
  
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  // Pre-validate domain against disposable email blacklist
  if (isBlockedEmailDomain(trimmedEmail)) {
    throw new Error('Temporary or disposable email addresses are not allowed. Please use a permanent email.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const user = userCredential.user;

    // Dispatch verification email immediately
    try {
      await sendEmailVerification(user);
    } catch (verifErr) {
      console.warn('Could not send initial verification email:', verifErr);
    }

    return user;
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Authenticates an existing user and enforces mandatory email verification.
 */
export async function signIn(email: string, password: string): Promise<User> {
  const trimmedEmail = (email || '').trim().toLowerCase();

  if (!trimmedEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const user = userCredential.user;

    // Check mandatory email verification
    if (!user.emailVerified) {
      // Sign out unverified session
      await firebaseSignOut(auth);
      throw new Error('Your email address is not verified yet. Please check your inbox and click the verification link before signing in.');
    }

    return user;
  } catch (err: any) {
    if (err.message && err.message.includes('not verified')) {
      throw err;
    }
    throw new Error(formatAuthError(err));
  }
}

/**
 * Signs out the current user session.
 */
export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}

/**
 * Re-sends the verification email to the current user.
 */
export async function resendVerification(user: User): Promise<void> {
  if (!user) {
    throw new Error('No active user session to send verification email.');
  }
  try {
    await sendEmailVerification(user);
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}
