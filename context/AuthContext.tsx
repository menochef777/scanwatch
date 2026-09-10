'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getFingerprintHash } from '../lib/fingerprint';
import { signUp, signIn, signOutUser } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  fingerprintHash: string;
  signUp: (email: string, pass: string) => Promise<User>;
  signIn: (email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  fingerprintHash: '',
  signUp: async () => { throw new Error('AuthContext not initialized'); },
  signIn: async () => { throw new Error('AuthContext not initialized'); },
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fingerprintHash, setFingerprintHash] = useState<string>('');

  useEffect(() => {
    // 1. Initialize device fingerprint hash on mount
    getFingerprintHash()
      .then((hash) => {
        setFingerprintHash(hash);
      })
      .catch((err) => {
        console.error('Error getting fingerprint hash in AuthProvider:', err);
      });

    // 2. Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
    }
  };

  const handleSignUp = async (email: string, pass: string) => {
    const createdUser = await signUp(email, pass);
    setUser(createdUser);
    return createdUser;
  };

  const handleSignIn = async (email: string, pass: string) => {
    const loggedUser = await signIn(email, pass);
    setUser(loggedUser);
    return loggedUser;
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        fingerprintHash,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
