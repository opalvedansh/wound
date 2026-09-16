import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumButton } from '../components/PremiumButton';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

export const PatientIntakeScreen = () => {
  const navigation = useNavigation<any>();
  const addPatient = useVisitStore((state) => state.addPatient);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [error, setError] = useState('');

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleCreate = () => {
    if (!firstName || !lastName || !patientId) {
      setError('First Name, Last Name, and Patient ID are required.');
      return;
    }
    
    setError('');
    
    // Save to global state (mocks offline save/sync queue)
    addPatient({
      firstName,
      lastName,
      patientId,
      dob,
      sex,
      location: 'Clinic A' // Default location for MVP
    });
    
    // In MVP we can navigate to Patient List to see the new patient
    navigation.replace('PatientList');
  };

  const renderInput = (
    placeholder: string, 
    value: string, 
    onChangeText: (t: string) => void, 
    id: string
  ) => {
    const isFocused = focusedInput === id;
    return (
      <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
        <TextInput 
          style={styles.input} 
          placeholder={placeholder} 
          placeholderTextColor={colors.textTertiary} 
          value={value} 
          onChangeText={onChangeText}
          onFocus={() => setFocusedInput(id)}
          onBlur={() => setFocusedInput(null)}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="h3" style={styles.navTitle}>New Patient</Text>
          <View style={{width: 40}}/>
        </View>
        
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={18} color={colors.error} style={{marginRight: 8}}/>
              <Text variant="bodyMedium" style={{color: colors.error}}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text variant="caption" style={styles.label}>Patient Identity</Text>
              <Text variant="caption" style={styles.requiredAsterisk}> *</Text>
            </View>
            
            {renderInput("First Name", firstName, setFirstName, "firstName")}
            {renderInput("Last Name", lastName, setLastName, "lastName")}
            {renderInput("Patient ID (e.g., MRN)", patientId, setPatientId, "patientId")}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text variant="caption" style={styles.label}>Demographics</Text>
            </View>
            <View style={styles.row}>
              <View style={{flex: 1, marginRight: spacing.sm}}>
                {renderInput("Date of Birth", dob, setDob, "dob")}
              </View>
              <View style={{flex: 1, marginLeft: spacing.sm}}>
                {renderInput("Sex", sex, setSex, "sex")}
              </View>
            </View>
          </View>

        </ScrollView>
        <View style={styles.footer}>
          <PremiumButton title="Create Patient" onPress={handleCreate} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  navBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md,
    backgroundColor: '#F8FAFC',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  navTitle: {
    fontSize: 20,
  },
  container: { 
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  errorContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FEF2F2', 
    padding: spacing.md, 
    borderRadius: 12, 
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  inputGroup: { 
    marginBottom: spacing.xxl 
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  label: { 
    color: colors.textSecondary,
    letterSpacing: 1.2,
  },
  requiredAsterisk: {
    color: colors.error,
    fontWeight: '800',
  },
  inputContainer: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.04)', 
    borderRadius: 16, 
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  input: { 
    paddingHorizontal: spacing.lg, 
    paddingVertical: 18,
    fontSize: 17, 
    color: colors.textPrimary,
  },
  row: { 
    flexDirection: 'row' 
  },
  footer: { 
    padding: spacing.lg, 
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 10,
  }
});