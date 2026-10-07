import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ActionButton } from '../components/ActionButton';
import { CaptureTopBar, captureColors, captureFocus } from '../components/CaptureChrome';
import { Text } from '../components/Typography';
import { PHASE_NAME } from '../lib/format';
import { interactionStyle } from '../lib/interaction';
import { useTreatmentContext } from '../lib/treatmentContext';
import { mockAiAdapter } from '../lib/mockAiAdapter';
import { spacing } from '../lib/theme';
import { secureStorage } from '../store/secureStorage';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  Camera: { treatmentId: string; step: 'pre' | 'post' };
};

const CAPTURE_GUIDE_SEEN = 'capture-guide-seen';

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export const CameraScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'Camera'>>();
  const { treatmentId, step = 'pre' } = route.params || {};
  const { treatment, patientName, visit } = useTreatmentContext(treatmentId);
  const updateTreatment = useVisitStore((state) => state.updateTreatment);
  const { width, height } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);

  const [calibrated, setCalibrated] = React.useState(false);
  const [calibrating, setCalibrating] = React.useState(false);

  // A follow-up treatment starts with the previous post-treatment image as its pre-treatment image, so review that
  // first. It's pushed rather than replaced so Retake comes back to this camera, and only while this screen is
  // showing: approving a new image on the review above it changes preImageUri too.
  const inheritedReviewed = React.useRef(false);
  React.useEffect(() => {
    if (step === 'pre' && treatment?.preImageUri && !inheritedReviewed.current && navigation.isFocused()) {
      inheritedReviewed.current = true;
      navigation.navigate('ImageReview', { treatmentId, step, imageUri: treatment.preImageUri });
    }
  }, [step, treatment?.preImageUri, navigation, treatmentId]);

  // The capture guide opens by itself the first time the camera is used (unless a carried-forward image is being
  // reviewed first); after that it's behind the help button.
  React.useEffect(() => {
    if (step === 'pre' && treatment?.preImageUri) return;
    let cancelled = false;
    Promise.resolve(secureStorage.getItem(CAPTURE_GUIDE_SEEN))
      .then(async (seen) => {
        if (seen || cancelled) return;
        await secureStorage.setItem(CAPTURE_GUIDE_SEEN, '1');
        if (!cancelled) navigation.navigate('CaptureGuide');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Only on opening the camera.
  }, []);

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

  const phase = PHASE_NAME[step];
  const title = `${phase} image`;
  const context = [patientName, visit].filter(Boolean).join(', ');
  const close = () => navigation.goBack();

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
        <CaptureTopBar
          title={title}
          context={context}
          onClose={close}
          closeLabel="Close camera"
          onHelp={() => navigation.navigate('CaptureGuide')}
        />
        <View style={styles.permission}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            {permission.canAskAgain
              ? 'Wound images are taken with the camera. Allow access to continue.'
              : "Camera access is turned off for this app. Turn it on in your device's settings, then come back."}
          </Text>
          {permission.canAskAgain && (
            <View style={styles.permissionAction}>
              <ActionButton label="Allow camera access" icon="camera" onPress={requestPermission} />
            </View>
          )}
        </View>
      </SafeAreaView>
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
              calibrated,
            },
          });
          navigation.navigate('ImageReview', { treatmentId, step, imageUri: photo.uri });
        }
      } catch (err) {
        console.error('Failed to take picture', err);
      }
    } else {
      // Fallback mock if camera fails
      const mockUri = `mock-camera-image-${Date.now()}`;
      navigation.navigate('ImageReview', { treatmentId, step, imageUri: mockUri });
    }
  };

  // Square guide sized to the screen, leaving room for the bars above and below.
  const guideSize = Math.round(Math.min(width - 64, height * 0.42, 320));
  const guideColor = calibrated ? captureColors.calibrated : captureColors.text;
  const status = calibrated
    ? { icon: 'check-circle' as const, color: captureColors.calibrated, text: 'Calibrated' }
    : calibrating
      ? { icon: 'loader' as const, color: captureColors.text, text: 'Looking for the calibration sticker' }
      : { icon: 'alert-circle' as const, color: captureColors.warning, text: 'Not calibrated' };
  const guidance = calibrated
    ? 'Frame the whole wound inside the guide.'
    : 'Place the calibration sticker next to the wound, inside the guide.';

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <CaptureTopBar
          title={title}
          context={context}
          onClose={close}
          closeLabel="Close camera"
          onHelp={() => navigation.navigate('CaptureGuide')}
        />
      </SafeAreaView>

      <View style={styles.viewfinder}>
        <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back" />

        <View style={styles.guideLayer}>
          <View style={{ width: guideSize, height: guideSize }}>
            {CORNERS.map((corner) => (
              <View key={corner} style={[styles.corner, styles[corner], { borderColor: guideColor }]} />
            ))}
            <View style={[styles.reticleHorizontal, { backgroundColor: guideColor }]} />
            <View style={[styles.reticleVertical, { backgroundColor: guideColor }]} />
          </View>
        </View>

        <View style={styles.statusLayer}>
          <View style={styles.status} accessibilityLiveRegion="polite">
            <Feather name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>
      </View>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.controlsArea}>
        <Text style={styles.guidance}>{guidance}</Text>
        <View style={styles.controls}>
          <View style={styles.side}>
            {/* Auto-detection keeps retrying, so manual calibration stays available the whole time. */}
            {!calibrated && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Calibrate manually"
                onPress={handleManualCalibration}
                hitSlop={8}
                style={(state) => [styles.textButton, interactionStyle(state, styles.textButtonHover, styles.textButtonPressed, captureFocus.ring)]}
              >
                <Text style={styles.textButtonLabel} numberOfLines={1}>
                  Calibrate
                </Text>
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Take ${phase.toLowerCase()} image`}
            onPress={handleCapture}
            style={(state) => [styles.shutter, interactionStyle(state, styles.shutterHover, styles.shutterPressed, captureFocus.ring)]}
          >
            <View style={styles.shutterCore} />
          </Pressable>
          <View style={styles.side} />
        </View>
      </SafeAreaView>
    </View>
  );
};

const ARM = 28;
const STROKE = 3;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: captureColors.background,
  },
  viewfinder: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#15181B',
  },

  guideLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: ARM,
    height: ARM,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderBottomRightRadius: 10,
  },
  reticleHorizontal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 18,
    height: 1.5,
    marginLeft: -9,
    opacity: 0.8,
  },
  reticleVertical: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1.5,
    height: 18,
    marginTop: -9,
    opacity: 0.8,
  },

  statusLayer: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 13, 15, 0.72)',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  controlsArea: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  guidance: {
    alignSelf: 'center',
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: captureColors.muted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  side: {
    flex: 1,
    alignItems: 'flex-start',
  },
  textButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: -10,
    borderRadius: 8,
  },
  textButtonHover: {
    backgroundColor: captureColors.control,
  },
  textButtonPressed: {
    backgroundColor: captureColors.controlPressed,
  },
  textButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: captureColors.text,
  },
  // The shutter is the one full circle here: it is the camera's universal capture control.
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: captureColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterHover: {
    borderColor: '#FFFFFF',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: captureColors.text,
  },

  permission: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  permissionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: captureColors.text,
  },
  permissionBody: {
    marginTop: 8,
    maxWidth: 360,
    fontSize: 17,
    lineHeight: 24,
    color: captureColors.muted,
  },
  permissionAction: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
});
