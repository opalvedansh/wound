import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { Text } from '../components/Typography';
import { spacing, colors } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  TherapyTracking: { treatmentId: string };
};

const Chip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
  <TouchableOpacity 
    style={[styles.chip, selected && styles.chipSelected]} 
    onPress={onPress}
  >
    <Text variant="bodyMedium" style={{ color: selected ? '#fff' : colors.textPrimary }}>{label}</Text>
  </TouchableOpacity>
);

const ChipGroup = ({ options, selected, onChange, multi = false }: { options: string[], selected: string | string[], onChange: (val: any) => void, multi?: boolean }) => {
  return (
    <View style={styles.chipGroup}>
      {options.map(opt => {
        const isSelected = multi ? (selected as string[]).includes(opt) : selected === opt;
        return (
          <Chip 
            key={opt} 
            label={opt} 
            selected={isSelected} 
            onPress={() => {
              if (multi) {
                const arr = selected as string[];
                onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
              } else {
                onChange(opt);
              }
            }} 
          />
        );
      })}
    </View>
  );
};

export const TherapyTrackingScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'TherapyTracking'>>();
  const treatmentId = route.params?.treatmentId;
  const { updateTreatment, completePostPhase, treatments } = useVisitStore();
  const treatment = treatments.find(t => t.id === treatmentId);

  const [therapyGiven, setTherapyGiven] = useState<string[]>(treatment?.therapy?.therapyGiven || []);
  const [dressingType, setDressingType] = useState(treatment?.therapy?.dressingType || '');
  const [nextVisitDate, setNextVisitDate] = useState(treatment?.therapy?.nextVisitDate || '');

  const handleSave = () => {
    updateTreatment(treatmentId, {
      therapy: {
        therapyGiven,
        dressingType,
        nextVisitDate,
      }
    });
    
    completePostPhase(treatmentId);
    navigation.navigate('CaseDetail', { caseId: treatment?.caseId });
  };

  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>POST-WOUND CARE</Text>
        <Text variant="h1" style={styles.title}>Therapy Tracking</Text>
        <Text variant="body" style={styles.desc}>Record the applied therapy and next steps.</Text>
      </View>

      <View style={styles.formSection}>
        <Text variant="caption" style={styles.sectionTitle}>THERAPY GIVEN (Select all that apply)</Text>
        <ChipGroup 
          options={['Debridement', 'Cleansing', 'Negative Pressure (NPWT)', 'Skin Substitute', 'Compression', 'None']}
          selected={therapyGiven}
          onChange={setTherapyGiven}
          multi
        />
      </View>

      <View style={styles.formSection}>
        <Text variant="caption" style={styles.sectionTitle}>DRESSING TYPE *</Text>
        <ChipGroup 
          options={['Foam', 'Gauze', 'Alginate', 'Hydrogel', 'Hydrocolloid', 'Collagen', 'Silver', 'None']}
          selected={dressingType}
          onChange={setDressingType}
        />
      </View>

      <View style={styles.formSection}>
        <Text variant="caption" style={styles.sectionTitle}>NEXT VISIT / ACTION DATE</Text>
        <ChipGroup 
          options={['In 3 Days', '1 Week', '2 Weeks', '1 Month', 'PRN (As Needed)']}
          selected={nextVisitDate}
          onChange={setNextVisitDate}
        />
      </View>

      <View style={styles.actions}>
        <PremiumButton title="Complete Treatment" onPress={handleSave} variant="primary" style={styles.button} disabled={!dressingType} />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  caption: { marginBottom: spacing.xs },
  title: { marginBottom: spacing.sm },
  desc: { marginBottom: spacing.lg, color: colors.textSecondary },
  formSection: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.md, color: colors.textTertiary, fontWeight: '700' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  actions: { paddingVertical: spacing.xl },
  button: { width: '100%' }
});
