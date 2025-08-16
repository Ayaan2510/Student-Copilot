/**
 * Authentication Context for Teacher Dashboard
 * Manages user authentication state and API tokens
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import type { TeacherUser, AuthResponse } from '@shared/types';

interface AuthContextType {
  user: TeacherUser | null;
  loading: boolean;
  login: (email: string, password: string, domain: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        refreshToken();
      }, 15 * 60 * 1000); // Refresh every 15 minutes

      return () => clearInterval(interval);
    }
  }, [user]);

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in API client
      apiClient.setAuthToken(token);

      // Verify token and get user info
      const response = await apiClient.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        apiClient.setAuthToken(null);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      localStorage.removeItem('auth_token');
      apiClient.setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, domain: string): Promise<boolean> => {
    try {
      setLoading(true);

      const response = await apiClient.login({
        email,
        password,
        domain
      });

      if (response.success && response.data) {
        const authData = response.data as AuthResponse;
        
        // Store token
        localStorage.setItem('auth_token', authData.token);
        apiClient.setAuthToken(authData.token);
        
        // Set user data
        setUser(authData.user as TeacherUser);
        
        // Navigate to intended page or dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
        
        toast.success('Welcome back!');
        return true;
      } else {
        toast.error(response.error || 'Login failed');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear local state
    setUser(null);
    localStorage.removeItem('auth_token');
    apiClient.setAuthToken(null);
    
    // Navigate to login
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await apiClient.refreshToken();
      
      if (response.success && response.data?.token) {
        localStorage.setItem('auth_token', response.data.token);
        apiClient.setAuthToken(response.data.token);
        return true;
      } else {
        // Refresh failed, logout user
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};