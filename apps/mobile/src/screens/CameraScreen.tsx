import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { PremiumCard } from '../components/PremiumCard';
import { Text } from '../components/Typography';
import { spacing, colors } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useVisitStore } from '../store/useVisitStore';
import { mockAiAdapter } from '../lib/mockAiAdapter';

type ParamList = {
  Camera: { treatmentId: string, step: 'pre' | 'post' };
};

export const CameraScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'Camera'>>();
  const { treatmentId, step } = route.params || {};

  const treatment = useVisitStore(state => state.treatments.find(t => t.id === treatmentId));
  const updateTreatment = useVisitStore(state => state.updateTreatment);
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  
  const [calibrated, setCalibrated] = React.useState(false);
  const [calibrating, setCalibrating] = React.useState(false);

  React.useEffect(() => {
    // If the step is 'pre' and there is already an inherited pre-image, skip directly to review
    if (step === 'pre' && treatment?.preImageUri) {
      navigation.replace('ImageReview', { treatmentId, step, imageUri: treatment.preImageUri });
    }
  }, [step, treatment?.preImageUri, navigation, treatmentId]);

  React.useEffect(() => {
    // Simulate auto-calibration when camera opens
    if (permission?.granted && !calibrated && !calibrating) {
      const runMockCalibration = async () => {
        setCalibrating(true);
        const isCalibrated = await mockAiAdapter.detectCalibrationSticker();
        setCalibrated(isCalibrated);
        setCalibrating(false);
      };
      runMockCalibration();
    }
  }, [permission?.granted, calibrated, calibrating]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
        <Text variant="h3" style={{ color: '#fff', marginBottom: spacing.md }}>We need your permission to show the camera</Text>
        <PremiumButton title="Grant Permission" onPress={requestPermission} variant="primary" />
      </View>
    );
  }

  const handleManualCalibration = () => {
    setCalibrated(true);
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo) {
          // Store metadata
          updateTreatment(treatmentId, {
            imageMetadata: {
              captureTimestamp: new Date().toISOString(),
              calibrated
            }
          });
          navigation.navigate('ImageReview', { treatmentId, step, imageUri: photo.uri });
        }
      } catch (err) {
        console.error("Failed to take picture", err);
      }
    } else {
      // Fallback mock if camera fails
      const mockUri = `mock-camera-image-${Date.now()}`;
      navigation.navigate('ImageReview', { treatmentId, step, imageUri: mockUri });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>STEP: {step === 'pre' ? 'PRE-WOUND' : 'POST-WOUND'}</Text>
        <Text variant="h1" style={styles.title}>Capture Frame</Text>
        <Text variant="body" style={styles.desc}>Align the calibration sticker within the guide area.</Text>
      </View>
      
      <View style={styles.viewfinderContainer}>
        <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back" />
        
        {/* Framing Guide */}
        <View style={[styles.viewfinderTarget, calibrated && styles.viewfinderTargetCalibrated]}>
          <Feather name="crosshair" size={48} color={calibrated ? colors.success : colors.accent} style={{opacity: 0.8}} />
        </View>

        {/* Calibration Status Badge */}
        <View style={styles.calibrationBadge}>
          <Text variant="caption" style={{ color: '#fff', fontWeight: 'bold' }}>
            {calibrated ? 'CALIBRATED' : (calibrating ? 'CALIBRATING...' : 'NOT CALIBRATED')}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {!calibrated && (
          <PremiumButton 
            title="Manual Calibration" 
            onPress={handleManualCalibration} 
            variant="secondary" 
            style={{ marginBottom: spacing.md }}
          />
        )}
        <PremiumButton 
          title="Capture Image" 
          onPress={handleCapture} 
          variant="primary" 
          style={styles.button} 
          icon="camera" 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: spacing.xl, paddingTop: spacing.xxl * 1.5, zIndex: 10 },
  caption: { color: colors.textTertiary, marginBottom: spacing.xs },
  title: { color: '#fff', marginBottom: spacing.sm },
  desc: { color: colors.textTertiary },
  viewfinderContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  viewfinderTarget: { width: 200, height: 200, borderWidth: 2, borderColor: colors.accent, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  viewfinderTargetCalibrated: { borderColor: colors.success, borderStyle: 'solid', borderWidth: 3 },
  calibrationBadge: { position: 'absolute', top: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actions: { padding: spacing.xl, paddingBottom: spacing.xxl, backgroundColor: '#000' },
  button: { width: '100%' }
});
