import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Image, StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { spacing } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';
import Feather from '@expo/vector-icons/Feather';
import { mockAiAdapter } from '../lib/mockAiAdapter';
import { supabase } from '../lib/supabase';

type ParamList = {
  ImageReview: { treatmentId: string, step: 'pre' | 'post', imageUri: string };
};

export const ImageReviewScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ImageReview'>>();
  const { treatmentId, step, imageUri } = route.params || {};
  const updateTreatment = useVisitStore(state => state.updateTreatment);
  const treatment = useVisitStore(state => state.treatments.find(t => t.id === treatmentId));

  const [qualityCheck, setQualityCheck] = React.useState<{ passed: boolean; reason?: string } | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [displayUri, setDisplayUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (imageUri) {
      if (imageUri.startsWith('file://') || imageUri.startsWith('mock-') || imageUri.startsWith('http')) {
        setDisplayUri(imageUri);
      } else {
        const fetchSignedUrl = async () => {
          const { data, error } = await supabase.storage.from('images').createSignedUrl(imageUri, 3600);
          if (data?.signedUrl) {
            setDisplayUri(data.signedUrl);
          } else {
            console.error('Error fetching signed URL:', error);
            setDisplayUri(imageUri);
          }
        };
        fetchSignedUrl();
      }
    }
  }, [imageUri]);

  React.useEffect(() => {
    const runCheck = async () => {
      setChecking(true);
      const result = await mockAiAdapter.checkImageQuality(imageUri);
      setQualityCheck(result);
      
      if (treatment) {
        const existingMetadata = treatment.imageMetadata || { captureTimestamp: new Date().toISOString(), calibrated: true };
        updateTreatment(treatmentId, {
          imageMetadata: {
            ...existingMetadata,
            lightingScore: result.lightingScore,
            blurScore: result.blurScore
          }
        });
      }
      setChecking(false);
    };
    
    if (!qualityCheck && checking) {
      runCheck();
    }
  }, [imageUri, treatmentId, updateTreatment, treatment]);

  const handleApprove = () => {
    if (qualityCheck && !qualityCheck.passed) {
      alert("Image quality is too low to proceed. Please retake.");
      return;
    }
    
    if (step === 'pre') {
      updateTreatment(treatmentId, { preImageUri: imageUri });
      navigation.navigate('ClinicalAssessment', { treatmentId });
    } else {
      updateTreatment(treatmentId, { postImageUri: imageUri });
      navigation.navigate('TherapyTracking', { treatmentId });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navSubtitle}>
            {step === 'pre' ? 'PRE-WOUND' : 'POST-WOUND'}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <Feather name="info" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.imageWrapper}>
          {displayUri && !displayUri.startsWith('mock') ? (
            <Image source={{ uri: displayUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderContainer}>
              <Feather name="camera-off" size={48} color="#333333" />
            </View>
          )}

          {/* Floating Quality Badge */}
          <View style={styles.badgePositioner}>
            {checking ? (
              <View style={[styles.qualityPill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <Feather name="loader" size={14} color="#FFFFFF" style={styles.badgeIcon} />
                <Text style={styles.badgeText}>ANALYZING QUALITY...</Text>
              </View>
            ) : qualityCheck ? (
              <View style={[styles.qualityPill, { backgroundColor: qualityCheck.passed ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)' }]}>
                <Feather name={qualityCheck.passed ? 'check-circle' : 'alert-circle'} size={14} color="#FFFFFF" style={styles.badgeIcon} />
                <Text style={styles.badgeText}>
                  {qualityCheck.passed ? 'QUALITY VERIFIED' : `POOR QUALITY: ${qualityCheck.reason?.toUpperCase()}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.retakeButton} onPress={() => navigation.goBack()}>
              <Feather name="rotate-ccw" size={18} color="#FFFFFF" />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.approveButton, 
                (checking || (qualityCheck !== null && !qualityCheck.passed)) && styles.buttonDisabled
              ]} 
              onPress={handleApprove}
              disabled={checking || (qualityCheck !== null && !qualityCheck.passed)}
            >
              <Text style={styles.approveButtonText}>
                {checking ? 'Analyzing...' : 'Use Image'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#000000' 
  },
  navBar: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.sm,
    backgroundColor: '#000000'
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  imageWrapper: { 
    flex: 1, 
    backgroundColor: '#111111', 
    borderRadius: 32, 
    overflow: 'hidden',
    position: 'relative',
    marginTop: spacing.sm,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: undefined,
    height: undefined,
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A'
  },
  badgePositioner: {
    position: 'absolute',
    top: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  qualityPill: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 100,
  },
  badgeIcon: {
    marginRight: 6,
  },
  badgeText: {
    color: '#FFFFFF', 
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    paddingTop: spacing.xl,
  },
  actions: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderRadius: 100,
    paddingVertical: 18,
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 18,
  },
  approveButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  }
});
