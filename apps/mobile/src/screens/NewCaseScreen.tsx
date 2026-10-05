import React, { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { BodyDiagram } from '../components/BodyDiagram';
import { DateInput, FormField, TextField, type DateInputHandle } from '../components/Form';
import { FormLayout } from '../components/FormLayout';
import { Text } from '../components/Typography';
import { EMPTY_DATE, isoDay, parseDay, readDateParts, timeAgo, type DateParts } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  NewCase: { patientId: string };
};

type Field = 'location' | 'onset';

export const NewCaseScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'NewCase'>>();
  const patientId = route.params?.patientId;
  const patient = useVisitStore((state) => state.patients.find((p) => p.id === patientId));
  const cases = useVisitStore((state) => state.cases);
  const addCase = useVisitStore((state) => state.addCase);

  const [location, setLocation] = useState('');
  const [onset, setOnset] = useState<DateParts>(EMPTY_DATE);
  const [submitted, setSubmitted] = useState(false);
  const locationRef = useRef<TextInputInstance>(null);
  const onsetRef = useRef<DateInputHandle>(null);
  const close = () => navigation.goBack();

  if (!patient) {
    return (
      <FormLayout title="New case" onClose={close}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Patient not found</Text>
          <Text style={styles.notFoundBody}>Open the patient again and add the case from there.</Text>
        </View>
      </FormLayout>
    );
  }

  const now = new Date();
  const started = readDateParts(onset);
  const birth = parseDay(patient.dob);
  const problems: Record<Field, string | undefined> = {
    location: location.trim() ? undefined : 'Enter the wound location',
    onset:
      started.problem === 'empty'
        ? 'Enter the onset date'
        : started.problem === 'invalid'
          ? 'Enter a real onset date'
          : started.date && started.date > now
            ? "Onset date can't be in the future"
            : started.date && birth && started.date < birth
              ? "Onset date is before the patient's date of birth"
              : undefined,
  };
  const errorFor = (field: Field) => (submitted ? problems[field] : undefined);

  // Two wounds can share a site, so this never blocks creating the case; it only flags a possible duplicate.
  const site = location.trim().toLowerCase();
  const openCaseAtSite =
    site !== '' &&
    cases.some((c) => c.patientId === patient.id && c.status !== 'COMPLETED' && c.woundLocation.trim().toLowerCase() === site);

  const handleCreate = () => {
    setSubmitted(true);
    if (problems.location) {
      locationRef.current?.focus();
      return;
    }
    if (problems.onset || !started.date) {
      onsetRef.current?.focus();
      return;
    }

    const caseId = addCase({
      patientId: patient.id,
      woundLocation: location.trim(),
      onsetDate: isoDay(started.date),
      status: 'IN_TREATMENT',
    });
    // Straight on to the case, where treatments and images are recorded.
    navigation.replace('CaseDetail', { caseId });
  };

  return (
    <FormLayout
      title="New case"
      subtitle={
        <>
          For <Text style={styles.patientName}>{`${patient.firstName} ${patient.lastName}`.trim()}</Text>, ID{' '}
          {patient.patientId}
        </>
      }
      onClose={close}
      submitLabel="Create case"
      onSubmit={handleCreate}
    >
      <View style={styles.fields}>
        <FormField
          label="Wound location"
          hint="Tap the body diagram, or type the side and body site"
          error={errorFor('location')}
          notice={openCaseAtSite ? `An open case for ${location.trim()} already exists.` : undefined}
        >
          <BodyDiagram value={location} onSelect={setLocation} />
          <TextField
            ref={locationRef}
            value={location}
            onChangeText={setLocation}
            placeholder="For example Left heel"
            accessibilityLabel="Wound location"
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => onsetRef.current?.focus()}
            invalid={errorFor('location') !== undefined}
          />
        </FormField>
        <FormField label="Onset date" hint="When the wound first appeared" error={errorFor('onset')}>
          <DateInput
            ref={onsetRef}
            value={onset}
            onChange={setOnset}
            spokenSuffix="of onset"
            invalid={errorFor('onset') !== undefined}
            trailing={started.date && problems.onset === undefined ? timeAgo(started.date, now) : undefined}
          />
        </FormField>
      </View>
    </FormLayout>
  );
};

const styles = StyleSheet.create({
  fields: {
    paddingTop: spacing.sm,
  },
  patientName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notFound: {
    marginTop: spacing.lg,
  },
  notFoundTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  notFoundBody: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
