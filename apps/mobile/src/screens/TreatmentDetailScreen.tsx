import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { PremiumButton } from '../components/PremiumButton';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  TreatmentDetail: { treatmentId: string };
};

export const TreatmentDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'TreatmentDetail'>>();
  const treatmentId = route.params?.treatmentId;
  const treatment = useVisitStore(state => state.treatments.find(t => t.id === treatmentId));

  if (!treatment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="chevron-left" size={28} color={colors.textPrimary} /></TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="h3">Treatment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="chevron-left" size={28} color={colors.textPrimary} /></TouchableOpacity>
        <Text variant="h3">Treatment T{treatment.sequenceNumber}</Text>
        <TouchableOpacity><Feather name="more-vertical" size={24} color={colors.textPrimary} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <Text variant="h2" style={{marginBottom: spacing.xl}}>
          {treatment.sequenceNumber === 1 ? 'Baseline Intake' : 'Follow-up Visit'}
        </Text>

        <Text variant="caption" style={{marginBottom: spacing.sm}}>BEFORE TREATMENT</Text>
        <PremiumCard style={{marginBottom: spacing.lg}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {treatment.preImageUri && !treatment.preImageUri.startsWith('mock') ? (
                <Image source={{ uri: treatment.preImageUri }} style={styles.mockImg} />
              ) : (
                <View style={[styles.mockImg, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Feather name="image" size={24} color={colors.textTertiary} />
                </View>
              )}
              <View style={{marginLeft: spacing.md}}>
                <Text variant="h3">Pre-Treatment</Text>
                <Text variant="body">{treatment.preImageUri ? 'Captured' : 'Pending'}</Text>
              </View>
            </View>
          </View>
        </PremiumCard>

        <Text variant="caption" style={{marginBottom: spacing.sm}}>AFTER TREATMENT</Text>
        <PremiumCard style={{marginBottom: spacing.xl}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {treatment.postImageUri && !treatment.postImageUri.startsWith('mock') ? (
                <Image source={{ uri: treatment.postImageUri }} style={styles.mockImg} />
              ) : (
                <View style={[styles.mockImg, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Feather name="image" size={24} color={colors.textTertiary} />
                </View>
              )}
              <View style={{marginLeft: spacing.md}}>
                <Text variant="h3">Post-Treatment</Text>
                <Text variant="body">{treatment.postImageUri ? 'Captured' : 'Pending'}</Text>
              </View>
            </View>
          </View>
        </PremiumCard>

        <Text variant="h3" style={{marginBottom: spacing.md}}>Care Provided</Text>
        <PremiumCard>
          <View style={styles.careRow}>
            <Text variant="bodyMedium">Therapy</Text>
            <Text variant="body">Debridement (Sharp)</Text>
          </View>
          <View style={styles.careRow}>
            <Text variant="bodyMedium">Dressing</Text>
            <Text variant="body">Foam (Adhesive)</Text>
          </View>
        </PremiumCard>

      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  container: { padding: spacing.lg },
  mockImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.border },
  careRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }
});