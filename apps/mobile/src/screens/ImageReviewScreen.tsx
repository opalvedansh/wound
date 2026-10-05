import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { ActionButton } from '../components/ActionButton';
import { CaptureTopBar, captureColors, captureFocus } from '../components/CaptureChrome';
import { Text } from '../components/Typography';
import { PHASE_NAME } from '../lib/format';
import { interactionStyle } from '../lib/interaction';
import { mockAiAdapter } from '../lib/mockAiAdapter';
import { supabase } from '../lib/supabase';
import { radii, spacing } from '../lib/theme';
import { useTreatmentContext } from '../lib/treatmentContext';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  ImageReview: { treatmentId: string; step: 'pre' | 'post'; imageUri: string };
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface StatusRowProps {
  icon: FeatherName;
  color: string;
  title: string;
  detail?: string;
}

// What to try next for each reason the quality check reports.
const RETAKE_TIPS: Record<string, string> = {
  'Image is too dark': 'Add light or move somewhere brighter.',
  'Image is too blurry': 'Hold the phone steady and let the camera focus.',
};

export const ImageReviewScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ImageReview'>>();
  const { treatmentId, step = 'pre', imageUri } = route.params || {};
  const updateTreatment = useVisitStore((state) => state.updateTreatment);
  const { treatment, patientName, visit } = useTreatmentContext(treatmentId);
  const previous = useVisitStore((state) =>
    treatment
      ? state.treatments.find((t) => t.caseId === treatment.caseId && t.sequenceNumber === treatment.sequenceNumber - 1)
      : undefined,
  );

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
            blurScore: result.blurScore,
          },
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
      alert('Image quality is too low to proceed. Please retake.');
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

  const phase = PHASE_NAME[step];
  const context = [patientName, visit].filter(Boolean).join(', ');
  // A new treatment's pre-treatment image starts as the previous treatment's post-treatment image (see addTreatment).
  const carriedFrom =
    step === 'pre' && !!imageUri && imageUri === previous?.postImageUri ? previous.sequenceNumber : undefined;
  const failed = qualityCheck !== null && !qualityCheck.passed;
  const reason = qualityCheck?.reason;

  const quality: StatusRowProps = checking
    ? { icon: 'loader', color: captureColors.text, title: 'Checking image quality' }
    : failed
      ? {
          icon: 'alert-triangle',
          color: captureColors.warning,
          title: 'Retake needed',
          detail: [reason ? `${reason}.` : undefined, reason ? RETAKE_TIPS[reason] : undefined].filter(Boolean).join(' '),
        }
      : { icon: 'check-circle', color: captureColors.calibrated, title: 'Image quality OK' };

  // Capture metadata describes the last image taken in this treatment, so it says nothing about a carried-forward one.
  const calibrated = carriedFrom === undefined ? treatment?.imageMetadata?.calibrated : undefined;
  const calibration: StatusRowProps | null =
    calibrated === undefined
      ? null
      : calibrated
        ? { icon: 'check-circle', color: captureColors.calibrated, title: 'Calibrated' }
        : {
            icon: 'alert-circle',
            color: captureColors.warning,
            title: 'Not calibrated',
            detail: "The calibration sticker wasn't confirmed for this image.",
          };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <CaptureTopBar
          title={`${phase} image`}
          context={context}
          onClose={() => navigation.goBack()}
          closeLabel="Back to camera"
          closeIcon="chevron-left"
        />
      </SafeAreaView>

      <View style={styles.imageArea}>
        {displayUri && !displayUri.startsWith('mock') ? (
          <Image
            source={{ uri: displayUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`${phase} image`}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.noPreview}>{displayUri ? 'No preview for this image' : 'Loading image'}</Text>
        )}
      </View>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.panel}>
        {carriedFrom !== undefined && (
          <Text style={styles.note}>Carried forward from treatment {carriedFrom}'s post-treatment image.</Text>
        )}
        <View style={styles.statusList} accessibilityLiveRegion="polite">
          <StatusRow {...quality} />
          {calibration && <StatusRow {...calibration} />}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={(state) => [
              styles.secondary,
              interactionStyle(state, styles.secondaryHover, styles.secondaryPressed, captureFocus.ring),
            ]}
          >
            <Feather name="rotate-ccw" size={18} color={captureColors.text} />
            <Text style={styles.secondaryLabel}>Retake</Text>
          </Pressable>
          <ActionButton
            label="Use image"
            icon="check"
            onPress={handleApprove}
            disabled={checking || failed}
            style={styles.primary}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const StatusRow = ({ icon, color, title, detail }: StatusRowProps) => (
  <View style={styles.statusRow}>
    <Feather name={icon} size={16} color={color} style={styles.statusIcon} />
    <View style={styles.statusBody}>
      <Text style={[styles.statusTitle, { color }]}>{title}</Text>
      {!!detail && <Text style={styles.statusDetail}>{detail}</Text>}
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: captureColors.background,
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15181B',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noPreview: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: captureColors.muted,
  },

  panel: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  note: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: captureColors.muted,
  },
  statusList: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusIcon: {
    marginTop: 2,
  },
  statusBody: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  statusDetail: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: captureColors.muted,
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  secondaryHover: {
    backgroundColor: captureColors.control,
  },
  secondaryPressed: {
    backgroundColor: captureColors.controlPressed,
  },
  secondaryLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: captureColors.text,
  },
  primary: {
    flex: 1,
    height: 52,
  },
});
