export const colors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#000000', // Absolute black for clinical contrast
  accent: '#005B4F', // Deep clinical teal
  accentLight: '#E0F2F1',
  error: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
};

export const typography = {
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: -1.2, color: colors.textPrimary },
  h2: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: colors.textPrimary },
  h3: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: colors.textPrimary },
  body: { fontSize: 17, fontWeight: '400', letterSpacing: -0.1, color: colors.textSecondary, lineHeight: 24 },
  bodyMedium: { fontSize: 17, fontWeight: '500', letterSpacing: -0.1, color: colors.textPrimary, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.textTertiary, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

import { Platform, type TextStyle } from 'react-native';

export const shadows = {
  sm: { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)', elevation: 1 } as any,
  md: { boxShadow: '0px 4px 16px rgba(0,0,0,0.06)', elevation: 3 } as any
};
