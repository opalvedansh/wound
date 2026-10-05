import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Typography';
import { colors, radii } from '../lib/theme';
import { interactionStyle } from '../lib/interaction';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  floating?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A screen's primary action, in the accent color. `floating` adds the lift used over scrolling content. */
export const ActionButton = ({ label, onPress, icon, floating = false, disabled = false, style }: ActionButtonProps) => (
  <Pressable
    accessibilityRole="button"
    aria-disabled={disabled}
    disabled={disabled}
    onPress={onPress}
    style={(state) => [
      styles.button,
      floating && styles.floating,
      style,
      disabled ? styles.disabled : interactionStyle(state, styles.hover, styles.pressed),
    ]}
  >
    {icon !== undefined && <Feather name={icon} size={18} color="#FFFFFF" />}
    <Text style={styles.label}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: radii.control,
    backgroundColor: colors.accent,
  },
  floating: {
    height: 52,
    paddingHorizontal: 22,
    boxShadow: '0px 8px 20px rgba(17, 24, 39, 0.18)',
    elevation: 6,
  },
  hover: {
    backgroundColor: colors.accentHover,
  },
  pressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
