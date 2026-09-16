import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { colors, spacing, shadows } from '../lib/theme';

interface PremiumCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export const PremiumCard = ({ children, onPress, style, noPadding = false }: PremiumCardProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  if (!onPress) {
    return <View style={[styles.card, noPadding && { padding: 0 }, style]}>{children}</View>;
  }

  return (
    <Pressable 
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start()} 
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()} 
      onPress={onPress}>
      <Animated.View style={[styles.card, noPadding && { padding: 0 }, { transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: 12, ...shadows.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }
});