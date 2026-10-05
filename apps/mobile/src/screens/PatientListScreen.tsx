import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import Feather from '@expo/vector-icons/Feather';
import type { Case, Patient, Treatment } from '@antigravity-project-spec-pack/domain';
import { ActionButton } from '../components/ActionButton';
import { JourneyTrack } from '../components/JourneyTrack';
import { SyncLabel } from '../components/SyncLabel';
import { Text } from '../components/Typography';
import {
  CASE_STATUS,
  TREND_COLOR,
  ageFrom,
  parseDate,
  plural,
  sentenceCase,
  sexLabel,
  visitLabel,
  type Trend,
} from '../lib/format';
import { focusStyles, interactionStyle, webInputReset } from '../lib/interaction';
import { syncIssueFor, useStalledSync, type SyncIssue } from '../lib/syncStatus';
import { breakpoints, colors, radii, spacing } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

// Corners follow `radii`; circles are reserved for the account button and the journey nodes.
const CONTENT_MAX_WIDTH = 680;
const THUMB = 44;
const ROW_GAP = 14;

const tone = {
  body: '#374151',
  hairline: '#ECEEF1',
  node: '#C3C8CF',
  tile: '#F1F3F5',
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface PatientRowModel {
  patient: Patient;
  name: string;
  initials: string;
  age: number | null;
  sex: string;
  thumbnailUri?: string;
  woundPrimary: string | null;
  woundSecondary?: string;
  trend?: Trend;
  visit: string | null;
  syncIssue: SyncIssue;
  search: string;
}

interface SyncSummary {
  icon: FeatherName;
  tone: StatusTone;
  text: string;
}

type StatusTone = 'neutral' | 'accent' | 'pending' | 'error';

// Tinted fill, hairline edge and ink for the header status chip; ink colors keep 4.5:1 on their fill.
const STATUS_TONE: Record<StatusTone, { fill: string; edge: string; ink: string }> = {
  neutral: { fill: '#F3F4F6', edge: '#E5E7EB', ink: colors.textSecondary },
  accent: { fill: '#EEF7F5', edge: '#D3E9E4', ink: colors.accent },
  pending: { fill: '#FFF8EE', edge: '#F8E1BF', ink: colors.pending },
  error: { fill: '#FEF3F2', edge: '#F9D4D0', ink: '#B42318' },
};

const compact = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');

const buildRows = (
  patients: Patient[],
  cases: Case[],
  treatments: Treatment[],
  stalledIds: Set<string>,
): PatientRowModel[] => {
  const now = new Date();
  const newestFirst = (a: Treatment, b: Treatment) => b.createdAt.localeCompare(a.createdAt);
  const byCase = new Map<string, Treatment[]>();
  for (const t of treatments) byCase.set(t.caseId, [...(byCase.get(t.caseId) ?? []), t]);

  // Newest registrations first, so a patient added from intake is at the top.
  return [...patients].reverse().map((patient) => {
    const own = cases.filter((c) => c.patientId === patient.id);
    const active = own.filter((c) => c.status !== 'COMPLETED');
    const visits = own.flatMap((c) => byCase.get(c.id) ?? []).sort(newestFirst);
    const imaged = visits.find((t) => t.postImageUri || t.preImageUri);
    const planned = visits.find((t) => t.therapy?.nextVisitDate);

    let woundPrimary: string | null = null;
    let woundSecondary: string | undefined;
    let trend: Trend | undefined;
    if (active.length === 1) {
      woundPrimary = sentenceCase(active[0].woundLocation) || 'Wound';
      woundSecondary = CASE_STATUS[active[0].status];
      trend = (byCase.get(active[0].id) ?? []).sort(newestFirst)[0]?.assessment?.woundAppearanceTrend;
    } else if (active.length > 1) {
      woundPrimary = plural(active.length, 'wound');
      woundSecondary = active.map((c) => sentenceCase(c.woundLocation)).filter(Boolean).join(', ');
    } else if (own.length > 0) {
      woundPrimary = 'Care completed';
    }

    const name = `${patient.firstName} ${patient.lastName}`.trim();
    return {
      patient,
      name,
      initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase(),
      age: ageFrom(patient.dob, now),
      sex: sexLabel(patient.sex),
      thumbnailUri: imaged?.postImageUri ?? imaged?.preImageUri,
      woundPrimary,
      woundSecondary,
      trend,
      visit: visitLabel(parseDate(planned?.therapy?.nextVisitDate), parseDate(visits[0]?.createdAt), now),
      syncIssue: syncIssueFor(patient.id, patient.syncState, stalledIds),
      search: `${name} ${patient.lastName} ${patient.firstName}`.toLowerCase(),
    };
  });
};

const matches = (row: PatientRowModel, query: string) =>
  row.search.includes(query) || compact(row.patient.patientId).includes(compact(query));

const describeSync = (queued: number, stalled: number, offline: boolean, hasPatients: boolean): SyncSummary => {
  if (offline) {
    return {
      icon: 'wifi-off',
      tone: 'neutral',
      text: queued ? `Offline · ${plural(queued, 'change')} saved on this device` : 'Offline · New records are saved on this device',
    };
  }
  if (stalled) {
    return { icon: 'alert-triangle', tone: 'error', text: `${plural(stalled, 'change')} could not sync` };
  }
  if (queued) {
    return { icon: 'upload-cloud', tone: 'pending', text: `${plural(queued, 'change')} waiting to sync` };
  }
  if (!hasPatients) {
    return { icon: 'smartphone', tone: 'accent', text: 'Works offline · Syncs when online' };
  }
  return { icon: 'check-circle', tone: 'accent', text: 'All changes synced' };
};

/** The persisted store loads asynchronously; until it has, show a skeleton instead of a false empty state. */
const useStoreHydrated = () => {
  const [hydrated, setHydrated] = useState(() => useVisitStore.persist.hasHydrated());
  useEffect(() => {
    if (useVisitStore.persist.hasHydrated()) setHydrated(true);
    return useVisitStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
};

export const PatientListScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // On wide screens "Add patient" sits in the header instead of floating over the list.
  const wide = useWindowDimensions().width >= breakpoints.wide;
  const hydrated = useStoreHydrated();
  const { isConnected } = useNetInfo();
  const patients = useVisitStore((state) => state.patients);
  const cases = useVisitStore((state) => state.cases);
  const treatments = useVisitStore((state) => state.treatments);
  const outbox = useVisitStore((state) => state.outbox);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const stalled = useStalledSync();
  const rows = useMemo(() => buildRows(patients, cases, treatments, stalled.ids), [patients, cases, treatments, stalled.ids]);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery ? rows.filter((row) => matches(row, normalizedQuery)) : rows;
  const hasPatients = hydrated && patients.length > 0;
  const sync = describeSync(
    outbox.length - stalled.items.length,
    stalled.items.length,
    isConnected === false,
    patients.length > 0,
  );
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const dayMonth = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  const offline = isConnected === false;
  const status = STATUS_TONE[sync.tone];
  const openIntake = () => navigation.navigate('PatientIntake');

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.today}>
          <Text style={styles.weekday}>{weekday}</Text>
          {'  '}
          {dayMonth}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Account and settings, ${offline ? 'offline' : 'online'}`}
          hitSlop={6}
          onPress={() => navigation.navigate('AccountSettings')}
          style={(state) => [styles.account, interactionStyle(state, styles.accountHover, styles.accountPressed)]}
        >
          <Text style={styles.accountInitials}>DC</Text>
          <View style={[styles.presence, offline && styles.presenceOffline]} />
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text variant="h1" style={styles.title} accessibilityRole="header">
            Patients
          </Text>
          {hasPatients && <Text style={styles.titleCount}>{rows.length}</Text>}
        </View>
        {hasPatients && wide && <ActionButton label="Add patient" icon="plus" onPress={openIntake} />}
      </View>

      {hydrated && (
        <View
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          style={[styles.status, { backgroundColor: status.fill, borderColor: status.edge }]}
        >
          <Feather name={sync.icon} size={13} color={status.ink} style={styles.statusIcon} />
          <Text style={[styles.statusText, { color: status.ink }]}>{sync.text}</Text>
        </View>
      )}

      {hasPatients && (
        <>
          <View style={[styles.search, searchFocused && styles.searchFocused]}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or patient ID"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, webInputReset]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search patients"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery('')}>
                <Feather name="x-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Text style={styles.listLabel}>
            {normalizedQuery ? `${visible.length} of ${plural(rows.length, 'patient')}` : plural(rows.length, 'patient')}
          </Text>
        </>
      )}
    </View>
  );

  const listEmpty = !hydrated ? (
    <SkeletonRows />
  ) : patients.length === 0 ? (
    <EmptyState onAdd={openIntake} />
  ) : (
    <NoMatches query={query.trim()} onClear={() => setQuery('')} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={hydrated ? visible : []}
        keyExtractor={(row) => row.patient.id}
        renderItem={({ item, index }) => (
          <PatientRow
            row={item}
            first={index === 0}
            last={index === visible.length - 1}
            onPress={() => navigation.navigate('Patient', { patientId: item.patient.id })}
          />
        )}
        ItemSeparatorComponent={RowSeparator}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (wide ? spacing.xxl : 112) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />

      {hasPatients && !wide && (
        <View style={[styles.fabLayer, { bottom: insets.bottom + spacing.lg }]}>
          <View style={styles.fabColumn}>
            <ActionButton label="Add patient" icon="plus" onPress={openIntake} floating />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const PatientRow = ({
  row,
  first,
  last,
  onPress,
}: {
  row: PatientRowModel;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ID ${row.patient.patientId}`}
      accessibilityHint="Opens the patient"
      onPress={onPress}
      style={(state) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        interactionStyle(state, styles.rowHover, styles.rowPressed, focusStyles.inset),
      ]}
    >
      <Thumbnail uri={row.thumbnailUri} initials={row.initials} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.visit !== null && <Text style={styles.visit}>{row.visit}</Text>}
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaText}>ID {row.patient.patientId}</Text>
          {row.age !== null && <Text style={styles.metaText}>{row.age} y</Text>}
          {row.sex.length > 0 && <Text style={styles.metaText}>{row.sex}</Text>}
        </View>

        {row.woundPrimary !== null ? (
          <View style={styles.wound}>
            <Text style={styles.woundPrimary}>{row.woundPrimary}</Text>
            {!!row.woundSecondary && (
              <Text style={styles.woundSecondary} numberOfLines={1}>
                {row.woundSecondary}
              </Text>
            )}
            {row.trend !== undefined && <Text style={[styles.trend, { color: TREND_COLOR[row.trend] }]}>{row.trend}</Text>}
          </View>
        ) : (
          <Text style={styles.woundNone}>No wound recorded yet</Text>
        )}

        {row.syncIssue !== null && <SyncLabel state={row.syncIssue} style={styles.rowSync} />}
      </View>

      <Feather name="chevron-right" size={18} color={tone.node} />
    </Pressable>
  );
};

const Thumbnail = ({ uri, initials }: { uri?: string; initials: string }) => {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} style={styles.thumb} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={styles.thumb}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
};

const RowSeparator = () => (
  <View style={styles.separatorTrack}>
    <View style={styles.separator} />
  </View>
);

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyTitle}>No patients yet</Text>
    <Text style={styles.emptyBody}>Add your first patient to begin tracking a wound.</Text>

    <JourneyTrack current={0} style={styles.journey} />
    <Text style={styles.journeyNote}>Each wound becomes its own case, followed visit by visit.</Text>

    <View style={styles.emptyAction}>
      <ActionButton label="Add first patient" icon="plus" onPress={onAdd} />
    </View>
  </View>
);

const NoMatches = ({ query, onClear }: { query: string; onClear: () => void }) => (
  <View style={styles.noMatches}>
    <Text style={styles.noMatchesTitle}>No patients match “{query}”</Text>
    <Text style={styles.noMatchesBody}>Search by first name, last name or patient ID.</Text>
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onClear}
      style={(state) => [styles.textButton, interactionStyle(state, styles.textButtonHover, styles.textButtonPressed)]}
    >
      <Text style={styles.textButtonLabel}>Clear search</Text>
    </Pressable>
  </View>
);

const SkeletonRows = () => (
  <View accessible accessibilityLabel="Loading patients" style={styles.skeleton}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={[styles.row, i === 0 && styles.rowFirst, i === 2 && styles.rowLast, i > 0 && styles.skeletonDivider]}>
        <View style={styles.thumb} />
        <View style={styles.rowBody}>
          <View style={[styles.skeletonBar, { width: '46%' }]} />
          <View style={[styles.skeletonBar, styles.skeletonBarThin, { width: '32%' }]} />
          <View style={[styles.skeletonBar, styles.skeletonBarThin, { width: '58%' }]} />
        </View>
      </View>
    ))}
  </View>
);

const hairline = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },

  header: {
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  today: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  weekday: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Accent-tinted disc with an inner white ring, so it reads as an avatar rather than a button outline.
  account: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentLight,
    borderWidth: 2,
    borderColor: colors.surface,
    boxShadow: '0px 0px 0px 1px rgba(0, 91, 79, 0.16), 0px 1px 2px rgba(17, 24, 39, 0.06)',
  },
  accountHover: {
    backgroundColor: '#D3ECE9',
  },
  accountPressed: {
    backgroundColor: '#C4E4E0',
  },
  accountInitials: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.accent,
  },
  // Connectivity at a glance: green when the device can reach the server, grey when it cannot.
  presence: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.success,
  },
  presenceOffline: {
    backgroundColor: colors.textTertiary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.6,
  },
  titleCount: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    marginTop: 14,
    paddingVertical: 5,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: radii.small,
    borderWidth: 1,
  },
  // Centers the 13px glyph on the first 18px line if the status wraps.
  statusIcon: {
    marginTop: 2.5,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.05,
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    marginTop: spacing.lg,
    paddingHorizontal: 14,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchFocused: {
    borderColor: colors.accent,
    boxShadow: '0px 0px 0px 3px rgba(0, 91, 79, 0.14)',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 16,
    color: colors.textPrimary,
  },
  listLabel: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
  },
  rowFirst: {
    borderTopWidth: hairline,
    borderTopLeftRadius: radii.control,
    borderTopRightRadius: radii.control,
  },
  rowLast: {
    borderBottomWidth: hairline,
    borderBottomLeftRadius: radii.control,
    borderBottomRightRadius: radii.control,
  },
  rowHover: {
    backgroundColor: colors.surfaceHover,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
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
  initials: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: tone.body,
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
  name: {
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
  meta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Wraps instead of truncating: a clipped wound location or status is worse than a taller row.
  wound: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 2,
    marginTop: 6,
  },
  woundPrimary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: tone.body,
  },
  woundSecondary: {
    flexShrink: 1,
    maxWidth: '100%',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  trend: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  woundNone: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  rowSync: {
    marginTop: 6,
  },
  separatorTrack: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: hairline,
    borderRightWidth: hairline,
  },
  separator: {
    height: hairline,
    marginLeft: spacing.md + THUMB + ROW_GAP,
    backgroundColor: tone.hairline,
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

  empty: {
    marginTop: 36,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  // Narrow measures keep both empty-state paragraphs from ending on a single word.
  emptyBody: {
    marginTop: 6,
    maxWidth: 280,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  journey: {
    marginTop: spacing.xl,
    marginBottom: 14,
  },
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

  noMatches: {
    paddingVertical: 28,
  },
  noMatchesTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noMatchesBody: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  textButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    marginLeft: -8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.small,
  },
  textButtonHover: {
    backgroundColor: colors.surfaceHover,
  },
  textButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  textButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.accent,
  },

  skeleton: {
    marginTop: 28,
  },
  skeletonDivider: {
    borderTopWidth: hairline,
    borderTopColor: tone.hairline,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: tone.tile,
  },
  skeletonBarThin: {
    height: 10,
    marginTop: 10,
  },
});
