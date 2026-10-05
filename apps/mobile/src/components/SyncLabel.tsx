import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Typography';
import { colors } from '../lib/theme';

type SyncLabelState = 'synced' | 'pending' | 'failed';

const LABELS: Record<
  SyncLabelState,
  { icon: React.ComponentProps<typeof Feather>['name']; iconColor: string; textColor: string; text: string }
> = {
  synced: { icon: 'check-circle', iconColor: colors.accent, textColor: colors.textSecondary, text: 'Synced' },
  pending: { icon: 'upload-cloud', iconColor: colors.pending, textColor: colors.pending, text: 'Waiting to sync' },
  failed: { icon: 'alert-triangle', iconColor: colors.error, textColor: colors.error, text: 'Could not sync' },
};

/** One record's sync state, worded and colored the same on every screen. */
export const SyncLabel = ({ state, style }: { state: SyncLabelState; style?: StyleProp<ViewStyle> }) => {
  const label = LABELS[state];
  return (
    <View style={[styles.row, style]}>
      <Feather name={label.icon} size={13} color={label.iconColor} />
      <Text style={[styles.text, { color: label.textColor }]}>{label.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
