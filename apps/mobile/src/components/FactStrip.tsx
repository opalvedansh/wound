import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Typography';
import { colors, radii } from '../lib/theme';

export interface Fact {
  label: string;
  value: string;
  valueColor?: string;
  /** A second, quieter line under the value, such as how long ago a date was. */
  detail?: string;
  detailColor?: string;
  /** Relative column width; give longer values more room so they stay on one line. */
  flex?: number;
}

/** Key facts in bordered columns, like the identity banner on a chart. Values wrap rather than truncate. */
export const FactStrip = ({ facts, style }: { facts: Fact[]; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.strip, style]}>
    {facts.map((fact, i) => (
      <View key={fact.label} style={[styles.fact, { flex: fact.flex ?? 1 }, i > 0 && styles.divider]}>
        <Text style={styles.label}>{fact.label}</Text>
        <Text style={[styles.value, fact.valueColor !== undefined && { color: fact.valueColor }]}>{fact.value}</Text>
        {fact.detail !== undefined && (
          <Text style={[styles.detail, fact.detailColor !== undefined && { color: fact.detailColor }]}>{fact.detail}</Text>
        )}
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fact: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  divider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
  },
  value: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
