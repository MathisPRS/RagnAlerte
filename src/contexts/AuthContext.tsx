import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { getUserById } from '../services/db';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'lumina_flow_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const { userId } = JSON.parse(saved);
          const u = await getUserById(userId);
          if (u) setUser(u);
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const refreshUser = async () => {
    if (user) {
      const updated = await getUserById(user.id);
      if (updated) setUser(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
