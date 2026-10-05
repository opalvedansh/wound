import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Typography';
import { colors } from '../lib/theme';

const STEPS = ['Patient', 'Case', 'Treatment', 'Pre/Post'];
const SPOKEN = ['patient', 'case', 'treatment', 'pre and post visit'];

/**
 * How care is recorded (Patient > Case > Treatment > Pre/Post). Steps before `current`
 * are drawn as done and `current` is highlighted, so empty states show where the clinician is.
 */
export const JourneyTrack = ({ current, style }: { current: number; style?: StyleProp<ViewStyle> }) => (
  <View
    style={[styles.track, style]}
    accessible
    accessibilityLabel={`Care is recorded as ${SPOKEN.join(', then ')}. Current step: ${SPOKEN[current]}.`}
  >
    {STEPS.map((step, i) => {
      const isLast = i === STEPS.length - 1;
      return (
        <View key={step} style={isLast ? styles.stepLast : styles.step}>
          <View style={styles.rail}>
            <View style={[styles.node, i < current && styles.nodeDone, i === current && styles.nodeCurrent]} />
            {!isLast && <View style={[styles.line, i < current && styles.lineDone]} />}
          </View>
          <Text style={[styles.label, i < current && styles.labelDone, i === current && styles.labelCurrent]}>{step}</Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
  },
  step: {
    flex: 1,
  },
  // Sized by its label so the track ends exactly at the last node.
  stepLast: {
    flexShrink: 0,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#C3C8CF',
    backgroundColor: colors.surface,
  },
  nodeDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  nodeCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    boxShadow: '0px 0px 0px 4px rgba(0, 91, 79, 0.14)',
  },
  line: {
    flex: 1,
    height: 1.5,
    marginHorizontal: 6,
    backgroundColor: '#D9DDE2',
  },
  lineDone: {
    backgroundColor: colors.accent,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
  },
  labelDone: {
    color: colors.textSecondary,
  },
  labelCurrent: {
    fontWeight: '600',
    color: colors.accent,
  },
});
