import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CASE_STATUS_LABEL, caseStatus, nextVisitDue, type Treatment } from '@antigravity-project-spec-pack/domain';
import { ActionButton } from '../components/ActionButton';
import { FactStrip, type Fact } from '../components/FactStrip';
import { JourneyTrack } from '../components/JourneyTrack';
import { SyncLabel } from '../components/SyncLabel';
import { Text } from '../components/Typography';
import {
  CASE_STATUS,
  STATUS_COLOR,
  TREND_COLOR,
  calendarDate,
  dayDiff,
  parseDate,
  parseDay,
  sentenceCase,
  timeAgo,
} from '../lib/format';
import { focusStyles, interactionStyle } from '../lib/interaction';
import { syncIssueFor, useStalledSync } from '../lib/syncStatus';
import { colors, radii, spacing } from '../lib/theme';
import { postPhoto, prePhoto } from '../lib/photos';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  CaseDetail: { caseId: string };
};

type Phase = 'pre' | 'post';
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const CONTENT_MAX_WIDTH = 680;
const RAIL_WIDTH = 20;
// Puts the timeline node's centre on the first line of the treatment title.
const NODE_OFFSET = 20;

const PHASE_LABEL: Record<Phase, string> = {
  pre: 'Pre-treatment',
  post: 'Post-treatment',
};

const tone = {
  body: '#374151',
  node: '#C3C8CF',
  rail: '#D9DDE2',
  tile: '#F1F3F5',
};

interface NextStep {
  title: string;
  body: string;
  label: string;
  icon: FeatherName;
  onPress: () => void;
}

export const CaseDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'CaseDetail'>>();
  const insets = useSafeAreaInsets();
  const caseId = route.params?.caseId;

  const woundCase = useVisitStore((state) => state.cases.find((c) => c.id === caseId));
  const patient = useVisitStore((state) => state.patients.find((p) => p.id === woundCase?.patientId));
  const allTreatments = useVisitStore((state) => state.treatments);
  const addTreatment = useVisitStore((state) => state.addTreatment);
  const stalled = useStalledSync();

  const treatments = useMemo(
    () => allTreatments.filter((t) => t.caseId === caseId).sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [allTreatments, caseId],
  );

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={6}
      onPress={() => navigation.goBack()}
      style={(state) => [styles.iconButton, interactionStyle(state, styles.iconButtonHover, styles.iconButtonPressed)]}
    >
      <Feather name="chevron-left" size={20} color={colors.textPrimary} />
    </Pressable>
  );

  if (!woundCase) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.page}>
          <View style={styles.column}>
            <View style={styles.topBar}>{backButton}</View>
            <View style={styles.notFound}>
              <Text style={styles.emptyTitle}>Case not found</Text>
              <Text style={styles.emptyBody}>This case isn't on this device.</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const now = new Date();
  const latest = treatments[treatments.length - 1];
  const trend = latest?.assessment?.woundAppearanceTrend;
  const woundType = [...treatments].reverse().find((t) => t.assessment?.woundType)?.assessment?.woundType;
  const onset = parseDay(woundCase.onsetDate);
  const lastVisit = parseDate(latest?.createdAt);
  const status = caseStatus(woundCase, treatments, now);
  const statusDetail = status?.reason ?? trend;
  const facts: Fact[] = [
    {
      label: 'Status',
      value: status ? CASE_STATUS_LABEL[status.status] : CASE_STATUS[woundCase.status],
      valueColor: status ? STATUS_COLOR[status.status] : undefined,
      // Why the case needs attention, otherwise the clinician's trend.
      detail: statusDetail,
      detailColor: status?.reason ? STATUS_COLOR[status.status] : trend ? TREND_COLOR[trend] : undefined,
      flex: 1.3,
    },
    {
      label: 'Onset',
      value: onset ? calendarDate(onset, now) : woundCase.onsetDate || 'Not recorded',
      detail: onset ? timeAgo(onset, now) : undefined,
    },
    {
      label: 'Last visit',
      value: lastVisit ? calendarDate(lastVisit, now) : 'None yet',
      detail: lastVisit ? timeAgo(lastVisit, now) : undefined,
    },
  ];

  const startTreatment = () => {
    const treatmentId = addTreatment(woundCase.id);
    navigation.navigate('Camera', { treatmentId, step: 'pre' });
  };

  const openTreatment = (t: Treatment) => {
    if (t.phase === 'PRE') navigation.navigate('Camera', { treatmentId: t.id, step: 'pre' });
    else if (t.phase === 'POST') navigation.navigate('Camera', { treatmentId: t.id, step: 'post' });
    else navigation.navigate('TreatmentDetail', { treatmentId: t.id });
  };

  // An open treatment is resumed rather than starting another one alongside it.
  const nextStep = ((): NextStep | null => {
    if (!latest) return null;
    const n = latest.sequenceNumber;
    if (latest.phase !== 'COMPLETED') {
      const phase: Phase = latest.phase === 'PRE' ? 'pre' : 'post';
      return {
        title: `Treatment ${n} in progress`,
        body: `${PHASE_LABEL[phase]} images are due.`,
        label: `Capture ${PHASE_LABEL[phase].toLowerCase()} images`,
        icon: 'camera',
        onPress: () => openTreatment(latest),
      };
    }
    const nextVisit = nextVisitDue(latest);
    return {
      title: `Treatment ${n} complete`,
      body:
        nextVisit && dayDiff(now, nextVisit) >= 0
          ? `Next visit planned for ${calendarDate(nextVisit, now)}.`
          : 'Start the next treatment when the patient returns.',
      label: `Start treatment ${n + 1}`,
      icon: 'plus',
      onPress: startTreatment,
    };
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.topBar}>
            {backButton}
            <SyncLabel state={syncIssueFor(woundCase.id, woundCase.syncState, stalled.ids) ?? 'synced'} />
          </View>

          {patient && (
            <Text style={styles.context}>
              <Text style={styles.contextName}>{`${patient.firstName} ${patient.lastName}`.trim()}</Text>, ID{' '}
              {patient.patientId}
            </Text>
          )}
          <Text variant="h2" style={styles.title} accessibilityRole="header">
            {sentenceCase(woundCase.woundLocation) || 'Location not recorded'}
          </Text>
          <Text style={[styles.woundType, woundType === undefined && styles.woundTypeMissing]}>
            {woundType ?? 'Wound type not recorded yet'}
          </Text>

          <FactStrip facts={facts} style={styles.facts} />

          {nextStep === null ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No treatments yet</Text>
              <Text style={styles.emptyBody}>The baseline visit starts treatment 1.</Text>
              <JourneyTrack current={2} style={styles.journey} />
              <Text style={styles.journeyNote}>Each treatment records pre-treatment and post-treatment images.</Text>
              <View style={styles.action}>
                <ActionButton label="Start baseline visit" icon="camera" onPress={startTreatment} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.nextStep}>
                <Text style={styles.nextTitle}>{nextStep.title}</Text>
                <Text style={styles.nextBody}>{nextStep.body}</Text>
                <View style={[styles.action, styles.nextAction]}>
                  <ActionButton label={nextStep.label} icon={nextStep.icon} onPress={nextStep.onPress} />
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Treatments
                </Text>
                <Text style={styles.sectionCount}>{treatments.length}</Text>
                {treatments.some((t) => t.phase === 'COMPLETED') && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Choose treatments for a PDF report"
                    hitSlop={6}
                    onPress={() => navigation.navigate('ReportBuilder', { caseId: woundCase.id })}
                    style={(state) => [styles.reportButton, interactionStyle(state, styles.iconButtonHover, styles.iconButtonPressed)]}
                  >
                    <Feather name="file-text" size={15} color={colors.accent} />
                    <Text style={styles.reportLabel}>Report</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.timeline}>
                {treatments.map((t, i) => (
                  <TreatmentRow
                    key={t.id}
                    treatment={t}
                    previousDone={i > 0 && treatments[i - 1].phase === 'COMPLETED'}
                    isFirst={i === 0}
                    isLast={i === treatments.length - 1}
                    now={now}
                    onPress={() => openTreatment(t)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const TreatmentRow = ({
  treatment: t,
  previousDone,
  isFirst,
  isLast,
  now,
  onPress,
}: {
  treatment: Treatment;
  previousDone: boolean;
  isFirst: boolean;
  isLast: boolean;
  now: Date;
  onPress: () => void;
}) => {
  const done = t.phase === 'COMPLETED';
  const started = parseDate(t.createdAt);
  const nextVisit = nextVisitDue(t);
  const trend = t.assessment?.woundAppearanceTrend;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Treatment ${t.sequenceNumber}, ${done ? 'completed' : 'in progress'}`}
      onPress={onPress}
      style={(state) => [styles.row, interactionStyle(state, styles.rowHover, styles.rowPressed, focusStyles.inset)]}
    >
      <View style={styles.rail}>
        <View style={[styles.railLine, styles.railTop, isFirst && styles.railHidden, previousDone && styles.railDone]} />
        <View style={[styles.node, done ? styles.nodeDone : styles.nodeCurrent]} />
        <View style={[styles.railLine, styles.railBottom, isLast && styles.railHidden, done && styles.railDone]} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle}>Treatment {t.sequenceNumber}</Text>
          {t.sequenceNumber === 1 && <Text style={styles.baseline}>Baseline</Text>}
          {started !== null && <Text style={styles.rowDate}>{calendarDate(started, now)}</Text>}
        </View>
        <Text style={[styles.rowStatus, !done && styles.rowStatusOpen]}>{done ? 'Completed' : 'In progress'}</Text>

        <View style={styles.phases}>
          <PhaseTile phase="pre" uri={prePhoto(t)} due={t.phase === 'PRE'} />
          <PhaseTile phase="post" uri={postPhoto(t)} due={t.phase === 'POST'} />
        </View>

        {(trend !== undefined || nextVisit !== null) && (
          <View style={styles.rowMeta}>
            {trend !== undefined && <Text style={[styles.trend, { color: TREND_COLOR[trend] }]}>{trend}</Text>}
            {nextVisit !== null && <Text style={styles.metaText}>Next visit {calendarDate(nextVisit, now)}</Text>}
          </View>
        )}
      </View>

      <Feather name="chevron-right" size={18} color={tone.node} style={styles.chevron} />
    </Pressable>
  );
};

/** One phase's image with its name underneath, so Pre and Post are never confused. */
const PhaseTile = ({ phase, uri, due }: { phase: Phase; uri?: string; due: boolean }) => {
  const [failed, setFailed] = useState(false);
  const label = PHASE_LABEL[phase];
  return (
    <View style={styles.phase}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.phaseImage}
          onError={() => setFailed(true)}
          accessibilityLabel={`${label} image`}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.phaseImage, styles.phaseEmpty]}>
          <Text style={[styles.phaseEmptyText, due && styles.phaseDue]}>{due ? 'Due' : 'Not captured'}</Text>
        </View>
      )}
      <Text style={styles.phaseLabel}>{label}</Text>
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

  context: {
    marginTop: spacing.lg,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  contextName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  title: {
    marginTop: 4,
    lineHeight: 34,
  },
  woundType: {
    marginTop: 2,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  woundTypeMissing: {
    fontWeight: '400',
    color: colors.textMuted,
  },
  facts: {
    marginTop: 20,
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
  action: {
    alignItems: 'flex-start',
  },
  notFound: {
    marginTop: spacing.xl,
  },

  nextStep: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  nextTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nextBody: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  nextAction: {
    marginTop: 14,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 36,
    marginBottom: 12,
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
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginLeft: 'auto',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reportLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.accent,
  },

  timeline: {
    overflow: 'hidden',
    borderRadius: radii.control,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.md,
  },
  rowHover: {
    backgroundColor: colors.surfaceHover,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  railLine: {
    width: 1.5,
    backgroundColor: tone.rail,
  },
  railTop: {
    height: NODE_OFFSET,
  },
  railBottom: {
    flex: 1,
  },
  railHidden: {
    backgroundColor: 'transparent',
  },
  railDone: {
    backgroundColor: colors.accent,
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  nodeDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  nodeCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    boxShadow: '0px 0px 0px 4px rgba(0, 91, 79, 0.14)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  baseline: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
  },
  rowDate: {
    marginLeft: 'auto',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowStatus: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textMuted,
  },
  rowStatusOpen: {
    color: colors.accent,
  },
  // Capped so the photo pair stays a comparison, not a gallery, on wide screens.
  phases: {
    flexDirection: 'row',
    gap: 10,
    maxWidth: 400,
    marginTop: 12,
  },
  phase: {
    flex: 1,
  },
  phaseImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.small,
    overflow: 'hidden',
    backgroundColor: tone.tile,
  },
  phaseEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textMuted,
  },
  phaseDue: {
    fontWeight: '600',
    color: colors.pending,
  },
  phaseLabel: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: tone.body,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 10,
    marginTop: 10,
  },
  trend: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    marginTop: 16,
  },
});
