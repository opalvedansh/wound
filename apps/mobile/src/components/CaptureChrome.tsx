import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Typography';
import { interactionStyle } from '../lib/interaction';

// Camera screens stay dark, like the system camera, so the preview isn't competing with bright UI.
// The accent teal is lightened here to stay legible on near-black.
export const captureColors = {
  background: '#0B0D0F',
  text: '#F5F7F8',
  muted: 'rgba(245, 247, 248, 0.66)',
  control: 'rgba(255, 255, 255, 0.12)',
  controlHover: 'rgba(255, 255, 255, 0.18)',
  controlPressed: 'rgba(255, 255, 255, 0.24)',
  hairline: 'rgba(255, 255, 255, 0.14)',
  calibrated: '#3DD6B5',
  warning: '#F5B544',
};

export const captureFocus = StyleSheet.create({
  ring: {
    outlineColor: captureColors.calibrated,
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: 2,
  },
});

/** Close button, the phase being captured, and whose wound it is, with an optional help button opposite. */
export const CaptureTopBar = ({
  title,
  context,
  onClose,
  closeLabel,
  closeIcon = 'x',
  onHelp,
}: {
  title: string;
  context?: string;
  onClose: () => void;
  closeLabel: string;
  closeIcon?: 'x' | 'chevron-left';
  onHelp?: () => void;
}) => (
  <View style={styles.bar}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
      hitSlop={6}
      onPress={onClose}
      style={(state) => [styles.button, interactionStyle(state, styles.buttonHover, styles.buttonPressed, captureFocus.ring)]}
    >
      <Feather name={closeIcon} size={20} color={captureColors.text} />
    </Pressable>
    <View style={styles.titles}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {!!context && (
        <Text style={styles.context} numberOfLines={1}>
          {context}
        </Text>
      )}
    </View>
    {onHelp ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How to take a good wound photo"
        hitSlop={6}
        onPress={onHelp}
        style={(state) => [styles.button, interactionStyle(state, styles.buttonHover, styles.buttonPressed, captureFocus.ring)]}
      >
        <Feather name="help-circle" size={20} color={captureColors.text} />
      </Pressable>
    ) : (
      // Balances the close button so the title stays centred.
      <View style={styles.spacer} />
    )}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: captureColors.control,
  },
  buttonHover: {
    backgroundColor: captureColors.controlHover,
  },
  buttonPressed: {
    backgroundColor: captureColors.controlPressed,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: captureColors.text,
  },
  context: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: captureColors.muted,
  },
  spacer: {
    width: 36,
  },
});
