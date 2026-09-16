import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Text } from './Typography';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';

interface PremiumButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | string;
  style?: StyleProp<ViewStyle>;
  icon?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
}

export const PremiumButton = ({ title, onPress, variant = 'primary', style, icon, disabled }: PremiumButtonProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isPrimary = variant === 'primary';
  const isAccent = variant === 'accent';

  return (
    <Pressable 
      onPressIn={() => !disabled && Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 20 }).start()}
      onPressOut={() => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}>
      <Animated.View style={[styles.btn, isPrimary ? styles.primary : isAccent ? styles.accent : styles.secondary, disabled && styles.disabled, { transform: [{ scale }] }, style]}>
        {icon && <Feather name={icon} size={20} color={disabled ? colors.textTertiary : (isPrimary || isAccent ? '#fff' : colors.primary)} style={{ marginRight: 8 }} />}
        <Text variant="bodyMedium" style={{ color: disabled ? colors.textTertiary : (isPrimary || isAccent ? '#fff' : colors.primary), fontWeight: '600' }}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
};
const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, width: '100%', marginBottom: 12 },
  primary: { backgroundColor: colors.primary },
  accent: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  disabled: { backgroundColor: '#F3F4F6', borderColor: colors.border, borderWidth: 1 }
});