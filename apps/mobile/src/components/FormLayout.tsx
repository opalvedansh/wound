import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { ActionButton } from './ActionButton';
import { Text } from './Typography';
import { interactionStyle } from '../lib/interaction';
import { breakpoints, colors, spacing } from '../lib/theme';

const FORM_MAX_WIDTH = 560;

/**
 * The shell shared by forms: title, a one-line subtitle, the fields, and the submit button, which is
 * pinned to the bottom on phones and follows the form on wide screens. `modal` forms get a close
 * button beside the title; `step` screens inside a flow get a back button above it, with an
 * optional `accessory` (such as the current phase) opposite.
 */
export const FormLayout = ({
  title,
  subtitle,
  onClose,
  submitLabel,
  onSubmit,
  mode = 'modal',
  accessory,
  scrollRef,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  submitLabel?: string;
  onSubmit?: () => void;
  mode?: 'modal' | 'step';
  accessory?: React.ReactNode;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
  children: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= breakpoints.wide;
  const submit =
    submitLabel !== undefined && onSubmit ? (
      <ActionButton label={submitLabel} onPress={onSubmit} style={wide ? undefined : styles.submit} />
    ) : null;
  const navButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mode === 'step' ? 'Back' : 'Close without saving'}
      hitSlop={6}
      onPress={onClose}
      style={(state) => [styles.close, interactionStyle(state, styles.closeHover, styles.closePressed)]}
    >
      <Feather name={mode === 'step' ? 'chevron-left' : 'x'} size={20} color={colors.textPrimary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, (wide || !submit) && { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <View style={styles.header}>
              {mode === 'step' && (
                <View style={styles.stepBar}>
                  {navButton}
                  {accessory}
                </View>
              )}
              <View style={styles.titleRow}>
                <Text variant="h2" style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
                {mode === 'modal' && navButton}
              </View>
              {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            {children}

            {wide && submit && <View style={styles.inlineAction}>{submit}</View>}
          </View>
        </ScrollView>

        {!wide && submit && <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{submit}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  column: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flexShrink: 1,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeHover: {
    backgroundColor: colors.surfaceHover,
  },
  closePressed: {
    backgroundColor: colors.surfacePressed,
  },
  inlineAction: {
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  footer: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submit: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    height: 52,
    alignSelf: 'center',
  },
});
