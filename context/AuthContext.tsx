'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getFingerprintHash } from '../lib/fingerprint';
import { signUp, signIn, signOutUser } from '../lib/auth';

export interface UserProfile {
  plan?: string;
  role?: string;
  trialMonitorUsed?: boolean;
  trialOCRUsed?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  fingerprintHash: string;
  signUp: (email: string, pass: string) => Promise<User>;
  signIn: (email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  fingerprintHash: '',
  signUp: async () => { throw new Error('AuthContext not initialized'); },
  signIn: async () => { throw new Error('AuthContext not initialized'); },
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fingerprintHash, setFingerprintHash] = useState<string>('');

  const fetchProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch(`/api/user-profile?uid=${currentUser.uid}&email=${encodeURIComponent(currentUser.email || '')}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data as UserProfile);
      } else {
        setProfile({ plan: 'free' });
      }
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
      setProfile({ plan: 'free' });
    }
  };

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      await fetchProfile(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
      await fetchProfile(auth.currentUser);
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
        profile,
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
