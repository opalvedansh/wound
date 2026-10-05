import React, { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DateInput, FormField, TextField, type DateInputHandle } from '../components/Form';
import { FormLayout } from '../components/FormLayout';
import { Segmented } from '../components/Segmented';
import { Text } from '../components/Typography';
import { EMPTY_DATE, ageFrom, isoDay, plural, readDateParts, type DateParts } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

// Same stored values and labels as the web portal's registration form.
const SEX_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
] as const;

type Sex = (typeof SEX_OPTIONS)[number]['value'];
type Field = 'firstName' | 'lastName' | 'patientId' | 'dob' | 'sex';

export const PatientIntakeScreen = () => {
  const navigation = useNavigation<any>();
  const patients = useVisitStore((state) => state.patients);
  const addPatient = useVisitStore((state) => state.addPatient);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [dob, setDob] = useState<DateParts>(EMPTY_DATE);
  const [sex, setSex] = useState<Sex | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const firstNameRef = useRef<TextInputInstance>(null);
  const lastNameRef = useRef<TextInputInstance>(null);
  const patientIdRef = useRef<TextInputInstance>(null);
  const dobRef = useRef<DateInputHandle>(null);

  const now = new Date();
  const birth = readDateParts(dob);
  const bornInFuture = birth.date !== undefined && birth.date > now;
  const normalizedId = patientId.trim().toLowerCase();
  // Patient IDs are unique in the database, so a clash is caught here instead of at sync time.
  const duplicate = normalizedId
    ? patients.find((patient) => patient.patientId.trim().toLowerCase() === normalizedId)
    : undefined;

  // Every rule, in form order. Only the duplicate ID shows before the first attempt to create.
  const problems: Record<Field, string | undefined> = {
    firstName: firstName.trim() ? undefined : "Enter the patient's first name",
    lastName: lastName.trim() ? undefined : "Enter the patient's last name",
    patientId: duplicate
      ? `Already used by ${duplicate.firstName} ${duplicate.lastName}`
      : normalizedId
        ? undefined
        : 'Enter the patient ID',
    dob:
      birth.problem === 'empty'
        ? 'Enter the date of birth'
        : birth.problem === 'invalid'
          ? 'Enter a real date of birth'
          : bornInFuture
            ? 'Date of birth must be in the past'
            : undefined,
    sex: sex ? undefined : "Select the patient's sex",
  };
  const errorFor = (field: Field) => (submitted || (field === 'patientId' && duplicate) ? problems[field] : undefined);
  const age = birth.date && !bornInFuture ? ageFrom(isoDay(birth.date), now) : null;

  const focusField: Partial<Record<Field, () => void>> = {
    firstName: () => firstNameRef.current?.focus(),
    lastName: () => lastNameRef.current?.focus(),
    patientId: () => patientIdRef.current?.focus(),
    dob: () => dobRef.current?.focus(),
  };

  const handleCreate = () => {
    setSubmitted(true);
    const firstProblem = (Object.keys(problems) as Field[]).find((field) => problems[field] !== undefined);
    if (firstProblem || !birth.date || !sex) {
      if (firstProblem) focusField[firstProblem]?.();
      return;
    }

    addPatient({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      patientId: patientId.trim(),
      dob: isoDay(birth.date),
      sex,
      location: 'Clinic A', // Default location for MVP
    });
    // Back to the list, where the new patient is at the top.
    navigation.goBack();
  };

  return (
    <FormLayout
      title="New patient"
      subtitle="Saved on this device, then synced."
      onClose={() => navigation.goBack()}
      submitLabel="Create patient"
      onSubmit={handleCreate}
    >
      <Text style={[styles.group, styles.groupFirst]} accessibilityRole="header">
        Identity
      </Text>
      <FormField label="First name" error={errorFor('firstName')}>
        <TextField
          ref={firstNameRef}
          value={firstName}
          onChangeText={setFirstName}
          accessibilityLabel="First name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => lastNameRef.current?.focus()}
          invalid={errorFor('firstName') !== undefined}
        />
      </FormField>
      <FormField label="Last name" error={errorFor('lastName')}>
        <TextField
          ref={lastNameRef}
          value={lastName}
          onChangeText={setLastName}
          accessibilityLabel="Last name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => patientIdRef.current?.focus()}
          invalid={errorFor('lastName') !== undefined}
        />
      </FormField>
      <FormField label="Patient ID" hint="Hospital number or MRN" error={errorFor('patientId')}>
        <TextField
          ref={patientIdRef}
          value={patientId}
          onChangeText={setPatientId}
          accessibilityLabel="Patient ID"
          autoCapitalize="characters"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => dobRef.current?.focus()}
          invalid={errorFor('patientId') !== undefined}
          style={styles.tabular}
        />
      </FormField>

      <Text style={styles.group} accessibilityRole="header">
        Demographics
      </Text>
      <FormField label="Date of birth" error={errorFor('dob')}>
        <DateInput
          ref={dobRef}
          value={dob}
          onChange={setDob}
          spokenSuffix="of birth"
          invalid={errorFor('dob') !== undefined}
          trailing={age !== null ? `${plural(age, 'year')} old` : undefined}
        />
      </FormField>
      <FormField label="Sex" error={errorFor('sex')}>
        <Segmented
          options={SEX_OPTIONS}
          value={sex}
          onChange={setSex}
          accessibilityLabel="Sex"
          invalid={errorFor('sex') !== undefined}
        />
      </FormField>
    </FormLayout>
  );
};

const styles = StyleSheet.create({
  group: {
    marginTop: spacing.xl,
    marginBottom: 2,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  groupFirst: {
    marginTop: spacing.lg,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
