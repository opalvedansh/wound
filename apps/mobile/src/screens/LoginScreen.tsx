import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '../components/Typography';
import { PremiumButton } from '../components/PremiumButton';
import { FormField, TextField } from '../components/Form';
import { colors, spacing } from '../lib/theme';
import { signIn } from '../lib/session';
import { syncNow } from '../lib/syncManager';

/** Sign in with the account the clinic admin invited (no self sign-up). */
export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
      void syncNow();
      navigation.reset({ index: 0, routes: [{ name: 'PatientList' }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in. Check your connection.");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.logo}>
          <Feather name="hexagon" size={44} color={colors.accent} />
        </View>
        <Text variant="h1" style={styles.title}>
          Sign in
        </Text>
        <Text variant="body" style={styles.subtitle}>
          Use the account your clinic admin invited. Records you add offline sync when you're back online.
        </Text>
        <FormField label="Email">
          <TextField
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
            placeholder="doctor@clinic.com"
            returnKeyType="next"
          />
        </FormField>
        <FormField label="Password" error={error}>
          <TextField
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        </FormField>
        {busy ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : (
          <PremiumButton title="Sign in" onPress={() => void submit()} icon="log-in" />
        )}
        <Text variant="caption" style={styles.note}>
          Forgot your password? Reset it from the sign-in page of the clinic portal.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { marginBottom: spacing.xl },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.xl, color: colors.textSecondary },
  spinner: { marginVertical: spacing.md },
  note: { marginTop: spacing.lg, color: colors.textMuted, textAlign: 'center' },
});
