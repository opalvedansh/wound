import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { PremiumButton } from '../components/PremiumButton';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';

export const ResultScreen = () => {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="x" size={28} color={colors.textPrimary} /></TouchableOpacity>
        <Text variant="h3">Analysis Result</Text>
        <View style={{width: 28}}/>
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.imageMock}>
          <Feather name="image" size={48} color={colors.border} />
          <View style={styles.maskOverlay} />
        </View>
        
        <View style={styles.confidenceBadge}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={styles.confidenceText}>High Confidence Measurement</Text>
        </View>

        <View style={styles.grid}>
          <PremiumCard style={styles.gridItem}>
            <Text variant="caption">Area</Text>
            <Text variant="h2" style={{color: colors.primary}}>14.2<Text variant="body"> cm²</Text></Text>
            <Text variant="body" style={{color: colors.success, fontSize: 13, marginTop: 4}}>↓ 1.1 cm² from T1</Text>
          </PremiumCard>
          <PremiumCard style={styles.gridItem}>
            <Text variant="caption">Dimensions</Text>
            <Text variant="h3">4.1 × 3.5<Text variant="body"> cm</Text></Text>
          </PremiumCard>
        </View>

        <PremiumCard style={{marginTop: spacing.md}}>
          <Text variant="h3" style={{marginBottom: spacing.md}}>Tissue Composition</Text>
          <View style={styles.barContainer}>
            <View style={[styles.barSegment, { flex: 70, backgroundColor: '#EF4444' }]} />
            <View style={[styles.barSegment, { flex: 20, backgroundColor: '#F59E0B' }]} />
            <View style={[styles.barSegment, { flex: 10, backgroundColor: '#10B981' }]} />
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#EF4444'}]}/><Text variant="body">70% Granulation</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#F59E0B'}]}/><Text variant="body">20% Slough</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#10B981'}]}/><Text variant="body">10% Epithelial</Text></View>
          </View>
        </PremiumCard>

        <View style={styles.actions}>
          <PremiumButton title="Save to Phase" onPress={() => navigation.navigate('PhaseOverview')} />
          <PremiumButton title="Retake Image" variant="secondary" onPress={() => navigation.navigate('ImageCapture')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  container: { padding: spacing.lg },
  imageMock: { width: '100%', height: 240, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md },
  maskOverlay: { position: 'absolute', width: 120, height: 100, borderWidth: 2, borderColor: colors.accent, borderRadius: 40, borderStyle: 'dashed' },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', paddingVertical: 8, borderRadius: 12, marginBottom: spacing.xl },
  confidenceText: { color: colors.success, fontWeight: '600', marginLeft: 8, fontSize: 13 },
  grid: { flexDirection: 'row', gap: spacing.md },
  gridItem: { flex: 1 },
  barContainer: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: spacing.lg },
  barSegment: { height: '100%' },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  actions: { marginTop: spacing.xxl }
});