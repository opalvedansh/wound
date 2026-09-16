import React, { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { Text } from '../components/Typography';
import { spacing, colors } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';
import Feather from '@expo/vector-icons/Feather';

type ParamList = {
  NewCase: { patientId: string };
};

export const NewCaseScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'NewCase'>>();
  const patientId = route.params?.patientId;
  const addCase = useVisitStore((state) => state.addCase);

  const [onsetDate, setOnsetDate] = useState('');
  const [woundLocation, setWoundLocation] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!onsetDate || !woundLocation) {
      setError('Both onset date and wound location are required.');
      return;
    }

    if (!patientId) {
      setError('Missing patient context.');
      return;
    }

    setError('');
    
    const newCaseId = addCase({
      patientId,
      onsetDate,
      woundLocation,
      status: 'IN_TREATMENT'
    });

    navigation.replace('CaseDetail', { caseId: newCaseId });
  };

  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>NEW CASE</Text>
        <Text variant="h1" style={styles.title}>Initialize Case</Text>
        <Text variant="body" style={styles.desc}>Define the anatomical location and onset date.</Text>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={16} color={colors.error} style={{marginRight: 6}}/>
          <Text variant="caption" style={{color: colors.error}}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text variant="caption" style={styles.label}>Onset Date *</Text>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} value={onsetDate} onChangeText={setOnsetDate} />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text variant="caption" style={styles.label}>Wound Location *</Text>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="e.g., Left Lower Leg" placeholderTextColor={colors.textTertiary} value={woundLocation} onChangeText={setWoundLocation} />
        </View>
      </View>

      <View style={styles.actions}>
        <PremiumButton title="Create Case" onPress={handleSave} variant="primary" style={styles.button} />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  caption: { marginBottom: spacing.xs },
  title: { marginBottom: spacing.sm },
  desc: { marginBottom: spacing.lg, color: colors.textSecondary },
  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.error + '1A', padding: spacing.md, borderRadius: 8, marginBottom: spacing.lg },
  inputGroup: { marginBottom: spacing.xl },
  label: { marginBottom: spacing.sm, marginLeft: 4, color: colors.textSecondary },
  inputContainer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: spacing.md },
  input: { padding: spacing.md, fontSize: 17, color: colors.textPrimary },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  button: { width: '100%' }
});
