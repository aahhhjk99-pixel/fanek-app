import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  bg: string;
  cardBg: string;
  headerBg: string;
  text: string;
  subtext: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  shadow: string;
  shadowOpacity: number;
  tabBarBg: string;
  tabBarBorder: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
  chipText: string;
  iconBg: string;
  promoBg: string;
  promoBorder: string;
  promoText: string;
  promoTitle: string;
  walletCardBg: string;
  walletCardText: string;
  blockedBg: string;
  blockedBorder: string;
  statusDot: string;
}

const lightColors: ThemeColors = {
  bg: '#f9fafb',
  cardBg: '#ffffff',
  headerBg: '#ffffff',
  text: '#111827',
  subtext: '#6b7280',
  border: '#e5e7eb',
  inputBg: '#f3f4f6',
  inputBorder: '#e5e7eb',
  primary: '#2563eb',
  primaryLight: '#eff6ff',
  primaryDark: '#1d4ed8',
  accent: '#f59e0b',
  success: '#16a34a',
  warning: '#f59e0b',
  error: '#ef4444',
  shadow: '#000',
  shadowOpacity: 0.08,
  tabBarBg: '#ffffff',
  tabBarBorder: '#e5e7eb',
  chipBg: '#ffffff',
  chipActiveBg: '#2563eb',
  chipActiveText: '#ffffff',
  chipText: '#374151',
  iconBg: '#eff6ff',
  promoBg: '#fffbeb',
  promoBorder: '#fde68a',
  promoText: '#b45309',
  promoTitle: '#92400e',
  walletCardBg: '#1e3a8a',
  walletCardText: '#ffffff',
  blockedBg: '#fef2f2',
  blockedBorder: '#fecaca',
  statusDot: '#9ca3af',
};

const darkColors: ThemeColors = {
  bg: '#0f0f0f',
  cardBg: '#1a1a1a',
  headerBg: '#1a1a1a',
  text: '#f5f5f5',
  subtext: '#9ca3af',
  border: '#2a2a2a',
  inputBg: '#222222',
  inputBorder: '#333333',
  primary: '#3b82f6',
  primaryLight: '#1e293b',
  primaryDark: '#1d4ed8',
  accent: '#f59e0b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  shadow: '#000',
  shadowOpacity: 0.3,
  tabBarBg: '#1a1a1a',
  tabBarBorder: '#2a2a2a',
  chipBg: '#222222',
  chipActiveBg: '#3b82f6',
  chipActiveText: '#ffffff',
  chipText: '#d1d5db',
  iconBg: '#1e293b',
  promoBg: '#1c1c1c',
  promoBorder: '#3a3a1a',
  promoText: '#fbbf24',
  promoTitle: '#fcd34d',
  walletCardBg: '#0c1a3a',
  walletCardText: '#f5f5f5',
  blockedBg: '#2a1515',
  blockedBorder: '#3a2020',
  statusDot: '#4b5563',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors: lightColors,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const saved = localStorage.getItem('fanek-theme') as ThemeMode | null;
      if (saved) setMode(saved);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (Platform.OS === 'web') {
        localStorage.setItem('fanek-theme', next);
      }
      return next;
    });
  }, []);

  const colors = mode === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
