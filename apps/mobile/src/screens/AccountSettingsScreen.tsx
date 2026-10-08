import React, { useEffect, useState } from 'react';
import { Alert, Platform, View, StyleSheet } from 'react-native';
import { pendingCount } from '@antigravity-project-spec-pack/domain/sync';
import type { Me } from '@antigravity-project-spec-pack/domain/api';
import { signOut, storedMe } from '../lib/session';
import { syncNow } from '../lib/syncManager';
import { useVisitStore } from '../store/useVisitStore';
import { useNavigation } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { PremiumCard } from '../components/PremiumCard';
import { Text } from '../components/Typography';
import { spacing } from '../lib/theme';

const ROLE: Record<string, string> = { ADMIN: 'Admin', DOCTOR: 'Doctor', FRONT_DESK: 'Front desk' };

export const AccountSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const [me, setMe] = useState<Me | null>(null);
  const pending = pendingCount(useVisitStore((s) => s.outbox));
  const lastSyncedAt = useVisitStore((s) => s.lastSyncedAt);
  useEffect(() => {
    void storedMe().then(setMe);
  }, []);

  const leave = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  const confirmSignOut = () => {
    const warning = pending
      ? `${pending} change${pending === 1 ? ' has' : 's have'} not reached the server yet and will be lost. Connect to the internet and sync first if you can.`
      : 'Patient records are removed from this device. They stay on the server.';
    if (Platform.OS === 'web') {
      if (window.confirm(warning)) void leave();
    } else {
      Alert.alert('Sign out?', warning, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void leave() },
      ]);
    }
  };

  const membership = me?.memberships[0];
  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="h1" style={styles.title}>Account</Text>
        <Text variant="body" style={styles.desc}>
          {me ? `${`${me.firstName} ${me.lastName}`.trim() || me.email}` : ''}
          {membership ? `\n${membership.clinicName} · ${ROLE[membership.role] ?? membership.role}` : ''}
        </Text>
        <Text variant="caption">
          {pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : 'Everything is synced'}
          {lastSyncedAt ? ` · last synced ${new Date(lastSyncedAt).toLocaleString()}` : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Sync now" onPress={() => void syncNow()} variant="secondary" icon="refresh-cw" style={styles.button} />
        <PremiumButton title="Sign out" onPress={confirmSignOut} variant="error" style={styles.button} />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl,
  },
  caption: {
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  desc: {
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  button: {
    width: '100%',
  }
});
