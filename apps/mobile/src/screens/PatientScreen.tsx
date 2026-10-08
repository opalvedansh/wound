import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  CASE_STATUS_LABEL,
  caseStatus,
  nextVisitDue,
  type Case,
  type CaseStatusResult,
  type Treatment,
} from '@antigravity-project-spec-pack/domain';
import { ActionButton } from '../components/ActionButton';
import { FactStrip } from '../components/FactStrip';
import { JourneyTrack } from '../components/JourneyTrack';
import { StatusLabel } from '../components/StatusLabel';
import { SyncLabel } from '../components/SyncLabel';
import { Text } from '../components/Typography';
import {
  CASE_STATUS,
  TREND_COLOR,
  ageFrom,
  calendarDate,
  fullDate,
  parseDate,
  parseDay,
  plural,
  sentenceCase,
  sexName,
  visitLabel,
  type Trend,
} from '../lib/format';
import { focusStyles, interactionStyle } from '../lib/interaction';
import { syncIssueFor, useStalledSync, type SyncIssue } from '../lib/syncStatus';
import { breakpoints, colors, radii, spacing } from '../lib/theme';
import { postPhoto, prePhoto } from '../lib/photos';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  Patient: { patientId: string };
};

const CONTENT_MAX_WIDTH = 680;
const THUMB = 56;
const ROW_GAP = 14;

const tone = {
  body: '#374151',
  hairline: '#ECEEF1',
  chevron: '#C3C8CF',
  tile: '#F1F3F5',
};

interface CaseRowModel {
  item: Case;
  number: number;
  thumbnailUri?: string;
  woundType?: string;
  status?: CaseStatusResult;
  trend?: Trend;
  treatments: number;
  onset: string | null;
  visit: string | null;
  syncIssue: SyncIssue;
}

const buildCaseRows = (cases: Case[], treatments: Treatment[], stalledIds: Set<string>): CaseRowModel[] => {
  const now = new Date();
  const newestFirst = (a: Treatment, b: Treatment) => b.createdAt.localeCompare(a.createdAt);
  // Case numbers follow creation order; open cases are listed before completed ones.
  const numbered = [...cases]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item, index) => ({ item, number: index + 1 }));
  const ordered = [
    ...numbered.filter(({ item }) => item.status !== 'COMPLETED'),
    ...numbered.filter(({ item }) => item.status === 'COMPLETED'),
  ];

  return ordered.map(({ item, number }) => {
    const visits = treatments.filter((t) => t.caseId === item.id).sort(newestFirst);
    const imaged = visits.find((t) => postPhoto(t) || prePhoto(t));
    const planned = visits.find((t) => t.therapy?.nextVisitDate);
    const onset = parseDay(item.onsetDate);
    return {
      item,
      number,
      thumbnailUri: postPhoto(imaged) ?? prePhoto(imaged),
      woundType: visits.find((t) => t.assessment?.woundType)?.assessment?.woundType,
      status: caseStatus(item, visits, now),
      trend: visits[0]?.assessment?.woundAppearanceTrend,
      treatments: visits.length,
      onset: onset ? calendarDate(onset, now) : item.onsetDate || null,
      visit: visitLabel(planned ? nextVisitDue(planned) : null, parseDate(visits[0]?.createdAt), now),
      syncIssue: syncIssueFor(item.id, item.syncState, stalledIds),
    };
  });
};

export const PatientScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'Patient'>>();
  const insets = useSafeAreaInsets();
  // On wide screens "New case" sits beside the section title instead of floating over the list.
  const wide = useWindowDimensions().width >= breakpoints.wide;
  const patientId = route.params?.patientId;

  const patient = useVisitStore((state) => state.patients.find((p) => p.id === patientId));
  const allCases = useVisitStore((state) => state.cases);
  const treatments = useVisitStore((state) => state.treatments);
  const stalled = useStalledSync();

  const cases = useMemo(() => allCases.filter((c) => c.patientId === patientId), [allCases, patientId]);
  const rows = useMemo(() => buildCaseRows(cases, treatments, stalled.ids), [cases, treatments, stalled.ids]);

  const openNewCase = () => navigation.navigate('NewCase', { patientId });
  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to patients"
      hitSlop={6}
      onPress={() => navigation.goBack()}
      style={(state) => [styles.iconButton, interactionStyle(state, styles.iconButtonHover, styles.iconButtonPressed)]}
    >
      <Feather name="chevron-left" size={20} color={colors.textPrimary} />
    </Pressable>
  );

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.page}>
          <View style={styles.column}>
            <View style={styles.topBar}>{backButton}</View>
            <View style={styles.notFound}>
              <Text style={styles.emptyTitle}>Patient not found</Text>
              <Text style={styles.emptyBody}>This record isn't on this device.</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const name = `${patient.firstName} ${patient.lastName}`.trim();
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase();
  const dob = parseDay(patient.dob);
  const age = ageFrom(patient.dob, new Date());
  // Column weights keep a full date of birth on one line at phone widths.
  const facts = [
    { label: 'Date of birth', value: dob ? fullDate(dob) : patient.dob || 'Not recorded', flex: 1.4 },
    { label: 'Age', value: age !== null ? plural(age, 'year') : 'Not recorded', flex: 1 },
    { label: 'Sex', value: sexName(patient.sex) || 'Not recorded', flex: 0.9 },
  ];
  const hasCases = rows.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + (hasCases && !wide ? 112 : spacing.xxl) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.topBar}>
            {backButton}
            <SyncLabel state={syncIssueFor(patient.id, patient.syncState, stalled.ids) ?? 'synced'} />
          </View>

          <View style={styles.identity}>
            <View style={styles.monogram}>
              <Text style={styles.monogramText}>{initials}</Text>
            </View>
            <View style={styles.identityText}>
              <Text variant="h2" style={styles.name} accessibilityRole="header" numberOfLines={2}>
                {name}
              </Text>
              <Text style={styles.patientId}>ID {patient.patientId}</Text>
            </View>
          </View>

          <FactStrip facts={facts} style={styles.facts} />
          {patient.consent ? (
            <View style={styles.consent}>
              <Feather name="shield" size={14} color={colors.textMuted} style={styles.consentIcon} />
              <Text style={styles.consentText}>
                Consent recorded {fullDate(new Date(patient.consent.recordedAt))}
                {patient.consent.aiTraining ? ' · photos may be used, de-identified, to improve measurement' : ' · photos not used for AI'}
              </Text>
            </View>
          ) : (
            <View style={styles.consent}>
              <Feather name="alert-circle" size={14} color={colors.pending} style={styles.consentIcon} />
              <Text style={[styles.consentText, styles.consentMissing]}>No consent recorded for this patient</Text>
            </View>
          )}

          {hasCases ? (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    Cases
                  </Text>
                  <Text style={styles.sectionCount}>{rows.length}</Text>
                </View>
                {wide && <ActionButton label="New case" icon="plus" onPress={openNewCase} />}
              </View>
              <View style={styles.list}>
                {rows.map((row, i) => (
                  <React.Fragment key={row.item.id}>
                    {i > 0 && <View style={styles.separator} />}
                    <CaseRow row={row} onPress={() => navigation.navigate('CaseDetail', { caseId: row.item.id })} />
                  </React.Fragment>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No cases yet</Text>
              <Text style={styles.emptyBody}>Each wound gets its own case.</Text>
              <JourneyTrack current={1} style={styles.journey} />
              <Text style={styles.journeyNote}>You'll record the wound's location and onset date next.</Text>
              <View style={styles.emptyAction}>
                <ActionButton label="Add first case" icon="plus" onPress={openNewCase} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {hasCases && !wide && (
        <View style={[styles.fabLayer, { bottom: insets.bottom + spacing.lg }]}>
          <View style={styles.fabColumn}>
            <ActionButton label="New case" icon="plus" onPress={openNewCase} floating />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const CaseRow = ({ row, onPress }: { row: CaseRowModel; onPress: () => void }) => {
  // Healing / Needs review / Overdue once the wound has a visit; before that (or once closed) its case state.
  const status = row.status ? CASE_STATUS_LABEL[row.status.status] : CASE_STATUS[row.item.status];
  const location = sentenceCase(row.item.woundLocation) || 'Location not recorded';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Case ${row.number}, ${location}, ${status}`}
      accessibilityHint="Opens the case"
      onPress={onPress}
      style={(state) => [styles.row, interactionStyle(state, styles.rowHover, styles.rowPressed, focusStyles.inset)]}
    >
      <CaseThumbnail uri={row.thumbnailUri} number={row.number} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.location} numberOfLines={2}>
            {location}
          </Text>
          {row.visit !== null && <Text style={styles.visit}>{row.visit}</Text>}
        </View>
        {row.woundType !== undefined && (
          <Text style={styles.woundType} numberOfLines={1}>
            {row.woundType}
          </Text>
        )}
        <View style={styles.statusRow}>
          {row.status !== undefined ? (
            <StatusLabel status={row.status.status} />
          ) : (
            <Text style={[styles.status, row.item.status === 'COMPLETED' && styles.statusDone]}>{status}</Text>
          )}
          {row.trend !== undefined && <Text style={[styles.trend, { color: TREND_COLOR[row.trend] }]}>{row.trend}</Text>}
        </View>
        <View style={styles.meta}>
          {row.onset !== null && <Text style={styles.metaText}>Onset {row.onset}</Text>}
          <Text style={styles.metaText}>{row.treatments ? plural(row.treatments, 'treatment') : 'No treatments yet'}</Text>
        </View>
        {row.syncIssue !== null && <SyncLabel state={row.syncIssue} style={styles.rowSync} />}
      </View>

      <Feather name="chevron-right" size={18} color={tone.chevron} />
    </Pressable>
  );
};

/** The latest wound photo, or the case number until one is captured. */
const CaseThumbnail = ({ uri, number }: { uri?: string; number: number }) => {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} style={styles.thumb} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={styles.thumb}>
      <Text style={styles.thumbLabel}>Case</Text>
      <Text style={styles.thumbNumber}>{number}</Text>
    </View>
  );
};

const hairline = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  column: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingTop: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonHover: {
    backgroundColor: colors.surfaceHover,
  },
  iconButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  monogram: {
    width: 56,
    height: 56,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tone.tile,
  },
  monogramText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: tone.body,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    lineHeight: 34,
  },
  patientId: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  facts: {
    marginTop: spacing.lg,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },
  // Centers the 14px glyph on the first 20px line if the text wraps.
  consentIcon: {
    marginTop: 3,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  consentMissing: {
    fontWeight: '500',
    color: colors.pending,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    marginTop: 36,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  list: {
    overflow: 'hidden',
    borderRadius: radii.control,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowHover: {
    backgroundColor: colors.surfaceHover,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  separator: {
    height: hairline,
    marginLeft: spacing.md + THUMB + ROW_GAP,
    backgroundColor: tone.hairline,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: tone.tile,
  },
  thumbLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  thumbNumber: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: tone.body,
    fontVariant: ['tabular-nums'],
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  location: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  visit: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  woundType: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 2,
    marginTop: 4,
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: tone.body,
  },
  statusDone: {
    color: colors.textMuted,
  },
  trend: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowSync: {
    marginTop: 6,
  },

  empty: {
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  journey: {
    marginTop: spacing.xl,
    marginBottom: 14,
  },
  // A narrow measure keeps the note from ending on a single word.
  journeyNote: {
    maxWidth: 320,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  emptyAction: {
    alignItems: 'flex-start',
  },
  notFound: {
    marginTop: spacing.xl,
  },

  fabLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    pointerEvents: 'box-none',
  },
  fabColumn: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH - spacing.lg * 2,
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
});
