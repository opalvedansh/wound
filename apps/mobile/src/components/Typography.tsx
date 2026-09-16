import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { typography } from '../lib/theme';

interface TypographyProps extends TextProps { variant?: keyof typeof typography; }
export const Text: React.FC<TypographyProps> = ({ variant = 'body', style, ...props }) => {
  return <RNText style={[typography[variant], style]} {...props} />;
};