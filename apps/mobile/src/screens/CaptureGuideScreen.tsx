import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CaptureTopBar, captureColors } from '../components/CaptureChrome';
import { Text } from '../components/Typography';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// Works offline: plain text and shapes, no video or downloaded images.
const TIPS: { icon: FeatherName; title: string; body: string }[] = [
  { icon: 'sun', title: 'Even light, no glare', body: 'Use bright, even light. Turn the flash off if it reflects off a wet wound.' },
  { icon: 'maximize', title: 'Fill the guide', body: 'Keep the whole wound inside the guide, with a margin of healthy skin around it.' },
  { icon: 'smartphone', title: 'Straight on to the skin', body: 'Hold the phone parallel to the skin, about 20 to 30 cm away. Angled photos distort the size.' },
  {
    icon: 'square',
    title: 'Sticker beside the wound',
    body: 'Place the calibration sticker flat on the skin next to the wound, never on it. Without a sticker, use Calibrate.',
  },
  { icon: 'pause-circle', title: 'Hold still, then shoot', body: 'Blurry or dark photos are flagged on review so you can retake them.' },
  { icon: 'repeat', title: 'Same setup every visit', body: 'Match the position, distance and light of earlier photos, so changes in the wound are real.' },
  { icon: 'eye-off', title: 'Keep the patient unidentifiable', body: 'Keep faces, tattoos and jewellery out of the frame.' },
];

/** How to take a measurable wound photo. Opens by itself on first use and from the camera's help button. */
export const CaptureGuideScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <CaptureTopBar title="Taking a good wound photo" onClose={() => navigation.goBack()} closeLabel="Close guide" />
      </SafeAreaView>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.column}>
          <FramingDiagram />
          {TIPS.map((tip, i) => (
            <View key={tip.title} style={styles.tip}>
              <View style={styles.tipIcon}>
                <Feather name={tip.icon} size={18} color={captureColors.calibrated} />
              </View>
              <View style={styles.tipText}>
                <Text style={styles.tipTitle}>{`${i + 1}. ${tip.title}`}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

/** The camera's guide with a wound inside it and the sticker beside the wound. */
const FramingDiagram = () => (
  <View style={styles.diagram} accessible accessibilityLabel="Diagram: the wound fills the guide, with the sticker on the skin beside it">
    <View style={styles.guide}>
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
        <View key={corner} style={[styles.corner, styles[corner]]} />
      ))}
      <View style={styles.wound} />
      <View style={styles.sticker} />
    </View>
    <View style={styles.legend}>
      <Text style={styles.legendText}>Wound</Text>
      <Text style={styles.legendText}>Sticker</Text>
    </View>
  </View>
);

const GUIDE = 180;
const ARM = 22;
const STROKE = 3;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: captureColors.background,
  },
  content: {
    paddingHorizontal: 24,
  },
  column: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  diagram: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  guide: {
    width: GUIDE,
    height: GUIDE,
  },
  corner: {
    position: 'absolute',
    width: ARM,
    height: ARM,
    borderColor: captureColors.calibrated,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 6 },
  topRight: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 6 },
  wound: {
    position: 'absolute',
    top: 42,
    left: 34,
    width: 96,
    height: 74,
    borderRadius: 40,
    transform: [{ rotate: '-12deg' }],
    backgroundColor: '#B4483F',
    borderWidth: 3,
    borderColor: '#E6A69A',
  },
  sticker: {
    position: 'absolute',
    right: 22,
    bottom: 26,
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: captureColors.text,
    backgroundColor: 'rgba(245, 247, 248, 0.18)',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: GUIDE,
    marginTop: 10,
  },
  legendText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: captureColors.muted,
  },

  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: captureColors.hairline,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: captureColors.control,
  },
  tipText: {
    flex: 1,
    minWidth: 0,
  },
  tipTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: captureColors.text,
  },
  tipBody: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 21,
    color: captureColors.muted,
  },
});
