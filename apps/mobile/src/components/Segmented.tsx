import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { focusStyles, interactionStyle } from '../lib/interaction';
import { colors, radii } from '../lib/theme';

const INSET = 3;

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** A one-of-a-few picker. Nothing is selected while `value` is undefined, so no answer is ever assumed. */
export const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  invalid = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  invalid?: boolean;
}) => (
  <View
    accessibilityRole="radiogroup"
    accessibilityLabel={accessibilityLabel}
    style={[styles.track, invalid && styles.trackInvalid]}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <Pressable
          key={String(option.value)}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          aria-checked={selected}
          onPress={() => onChange(option.value)}
          style={(state) => [
            styles.segment,
            selected && styles.selected,
            interactionStyle(state, !selected && styles.hover, !selected && styles.pressed, focusStyles.inset),
          ]}
        >
          <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: INSET,
    padding: INSET,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfacePressed,
  },
  trackInvalid: {
    borderColor: colors.error,
  },
  // Inner radius = outer radius minus the inset, so the corners stay concentric.
  segment: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control - INSET,
  },
  selected: {
    backgroundColor: colors.surface,
    boxShadow: '0px 1px 3px rgba(17, 24, 39, 0.12)',
    elevation: 1,
  },
  hover: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  labelSelected: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
