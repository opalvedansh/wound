import React, { useImperativeHandle, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Typography';
import type { DateParts } from '../lib/format';
import { interactionStyle, webInputReset } from '../lib/interaction';
import { colors, radii, spacing } from '../lib/theme';

/**
 * A labelled field. `error` blocks submission and is shown in red; `notice` is a non-blocking
 * heads-up (such as a possible duplicate) and only shows when there is no error.
 */
export const FormField = ({
  label,
  hint,
  error,
  notice,
  style,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  notice?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) => (
  <View style={[styles.field, style]}>
    <Text style={styles.label}>{label}</Text>
    {hint !== undefined && <Text style={styles.hint}>{hint}</Text>}
    {children}
    {error !== undefined ? (
      <View style={styles.messageRow} accessibilityRole="alert">
        <Feather name="alert-circle" size={14} color={colors.error} style={styles.messageIcon} />
        <Text style={[styles.messageText, { color: colors.error }]}>{error}</Text>
      </View>
    ) : notice !== undefined ? (
      <View style={styles.messageRow}>
        <Feather name="info" size={14} color={colors.pending} style={styles.messageIcon} />
        <Text style={[styles.messageText, { color: colors.pending }]}>{notice}</Text>
      </View>
    ) : null}
  </View>
);

export interface TextFieldProps extends TextInputProps {
  ref?: React.Ref<TextInputInstance>;
  invalid?: boolean;
}

// Autofill stays off: it would offer the clinician's own details for a patient's record.
export const TextField = ({ ref, invalid = false, style, onFocus, onBlur, ...props }: TextFieldProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      autoComplete="off"
      autoCorrect={false}
      spellCheck={false}
      placeholderTextColor={colors.textMuted}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        focused && styles.inputFocused,
        invalid && styles.inputInvalid,
        invalid && focused && styles.inputInvalidFocused,
        webInputReset,
        style,
      ]}
    />
  );
};

export interface DateInputHandle {
  /** Focuses the first empty part, or Day when all are filled. */
  focus: () => void;
}

const digits = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);

/**
 * Day / Month / Year boxes that move to the next box as each one fills. Spoken labels read
 * "Day {spokenSuffix}" and so on; `trailing` sits beside the boxes (an age, or how long ago).
 */
export const DateInput = ({
  ref,
  value,
  onChange,
  spokenSuffix,
  invalid = false,
  trailing,
  onSubmitEditing,
}: {
  ref?: React.Ref<DateInputHandle>;
  value: DateParts;
  onChange: (value: DateParts) => void;
  spokenSuffix: string;
  invalid?: boolean;
  trailing?: string;
  onSubmitEditing?: () => void;
}) => {
  const day = useRef<TextInputInstance>(null);
  const month = useRef<TextInputInstance>(null);
  const year = useRef<TextInputInstance>(null);

  useImperativeHandle(ref, () => ({
    focus: () => (!value.day ? day : !value.month ? month : !value.year ? year : day).current?.focus(),
  }));

  const update = (
    key: keyof DateParts,
    text: string,
    max: number,
    next?: React.RefObject<TextInputInstance | null>,
  ) => {
    const clean = digits(text, max);
    onChange({ ...value, [key]: clean });
    if (next && clean.length === max && value[key].length < max) next.current?.focus();
  };

  return (
    <View style={styles.dateRow}>
      <DatePart
        label="Day"
        ref={day}
        value={value.day}
        maxLength={2}
        invalid={invalid}
        accessibilityLabel={`Day ${spokenSuffix}`}
        onChangeText={(text) => update('day', text, 2, month)}
      />
      <DatePart
        label="Month"
        ref={month}
        value={value.month}
        maxLength={2}
        invalid={invalid}
        accessibilityLabel={`Month ${spokenSuffix}`}
        onChangeText={(text) => update('month', text, 2, year)}
      />
      <DatePart
        label="Year"
        ref={year}
        value={value.year}
        maxLength={4}
        invalid={invalid}
        accessibilityLabel={`Year ${spokenSuffix}`}
        onChangeText={(text) => update('year', text, 4)}
        onSubmitEditing={onSubmitEditing}
        style={styles.yearInput}
      />
      {trailing !== undefined && <Text style={styles.dateTrailing}>{trailing}</Text>}
    </View>
  );
};

/**
 * Wrapping option chips for single or multiple choice. Selected options also show a check,
 * so the state never depends on colour alone. A single choice can be cleared by tapping it
 * again unless the question is `required`.
 */
export const ChoiceChips = ({
  options,
  value,
  onChange,
  accessibilityLabel,
  multiple = false,
  required = false,
  invalid = false,
}: {
  options: readonly string[];
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  accessibilityLabel: string;
  multiple?: boolean;
  required?: boolean;
  invalid?: boolean;
}) => {
  const selected = multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' && value ? [value] : [];
  const toggle = (option: string) => {
    if (multiple) onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
    else onChange(selected.includes(option) && !required ? '' : option);
  };
  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      style={styles.chips}
    >
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onPress={() => toggle(option)}
            style={(state) => [
              styles.chip,
              on && styles.chipOn,
              invalid && !on && styles.chipInvalid,
              interactionStyle(state, !on && styles.chipHover, !on && styles.chipPressed),
            ]}
          >
            {on && <Feather name="check" size={14} color={colors.accent} />}
            <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

/** A yes/no choice with a sentence of explanation, such as a consent or a report option. */
export const CheckRow = ({
  label,
  description,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  invalid?: boolean;
}) => (
  <Pressable
    accessibilityRole="checkbox"
    aria-checked={value}
    accessibilityLabel={label}
    accessibilityHint={description}
    onPress={() => onChange(!value)}
    style={(state) => [styles.checkRow, interactionStyle(state, styles.chipHover, styles.chipPressed)]}
  >
    <View style={[styles.checkBox, value && styles.checkBoxOn, invalid && !value && styles.chipInvalid]}>
      {value && <Feather name="check" size={14} color={colors.surface} />}
    </View>
    <View style={styles.checkText}>
      <Text style={styles.checkLabel}>{label}</Text>
      {description !== undefined && <Text style={styles.checkDescription}>{description}</Text>}
    </View>
  </Pressable>
);

const DatePart = ({ label, style, ...props }: TextFieldProps & { label: string }) => (
  <View>
    <Text style={styles.partLabel}>{label}</Text>
    <TextField keyboardType="number-pad" inputMode="numeric" {...props} style={[styles.dateInput, style]} />
  </View>
);

const styles = StyleSheet.create({
  field: {
    marginTop: spacing.md,
  },
  label: {
    marginBottom: 6,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#374151',
  },
  hint: {
    marginTop: -2,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 17,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.accent,
    boxShadow: '0px 0px 0px 3px rgba(0, 91, 79, 0.14)',
  },
  inputInvalid: {
    borderColor: colors.error,
  },
  inputInvalidFocused: {
    boxShadow: '0px 0px 0px 3px rgba(220, 38, 38, 0.14)',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  partLabel: {
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dateInput: {
    width: 64,
    paddingHorizontal: 0,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  yearInput: {
    width: 88,
  },
  dateTrailing: {
    flexShrink: 1,
    marginBottom: 14,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: '#EEF6F4',
  },
  chipInvalid: {
    borderColor: colors.error,
  },
  chipHover: {
    backgroundColor: colors.surfaceHover,
  },
  chipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  chipLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#374151',
  },
  chipLabelOn: {
    fontWeight: '600',
    color: colors.accent,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radii.small,
  },
  checkBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: colors.surface,
  },
  checkBoxOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkText: {
    flex: 1,
    minWidth: 0,
  },
  checkLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  checkDescription: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  messageIcon: {
    marginTop: 2,
  },
  messageText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
});
