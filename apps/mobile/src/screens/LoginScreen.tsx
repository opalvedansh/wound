import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumButton } from '../components/PremiumButton';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logo}>
          <Feather name="hexagon" size={48} color={colors.accent} />
        </View>
        <Text variant="h1" style={styles.title}>Welcome back.</Text>
        <Text variant="body" style={styles.subtitle}>Enter your credentials to access the secure clinician portal.</Text>
        
        <View style={styles.inputMock}>
          <Feather name="mail" size={20} color={colors.textTertiary} />
          <Text variant="body" style={{ marginLeft: 12, color: colors.textPrimary }}>dr.chen@hospital.org</Text>
        </View>
        <View style={styles.inputMock}>
          <Feather name="lock" size={20} color={colors.textTertiary} />
          <Text variant="body" style={{ marginLeft: 12, color: colors.textPrimary }}>••••••••</Text>
        </View>

        <PremiumButton title="Sign In Securely" onPress={() => navigation.replace('PatientList')} icon="shield" />
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  logo: { marginBottom: spacing.xl },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.xxl },
  inputMock: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }
});