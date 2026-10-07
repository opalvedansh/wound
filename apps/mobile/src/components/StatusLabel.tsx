import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CASE_STATUS_LABEL, type CaseStatus } from '@antigravity-project-spec-pack/domain';
import { Text } from './Typography';
import { STATUS_COLOR } from '../lib/format';

/** A case's Healing / Needs review / Overdue status: always a dot and a word, never colour alone. */
export const StatusLabel = ({ status, style }: { status: CaseStatus; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.row, style]}>
    <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
    <Text style={[styles.text, { color: STATUS_COLOR[status] }]}>{CASE_STATUS_LABEL[status]}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
