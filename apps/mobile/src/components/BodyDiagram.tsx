import React, { useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type HostInstance,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import { Segmented } from './Segmented';
import { Text } from './Typography';
import { colors, radii } from '../lib/theme';

const FIGURE_WIDTH = 176;

// Boxes are [x, y, width, height] as percentages of the figure, drawn from the viewer's side.
type Box = [number, number, number, number];
type Site = { name: string; box: Box };
type BodyView = 'front' | 'back';

interface Figure {
  source: ImageSourcePropType;
  aspect: number;
  // Which of the patient's sides appears on the viewer's left: the front view faces the viewer, the back view faces away.
  viewerLeft: 'Right' | 'Left';
  // Tested first, so midline sites win over the sided ones they border.
  midline: Site[];
  // Drawn on the viewer's left half and mirrored for the other side. Earlier entries win where boxes overlap.
  sided: Site[];
}

const FIGURES: Record<BodyView, Figure> = {
  front: {
    source: require('../../assets/images/body-front.png'),
    aspect: 427 / 979,
    viewerLeft: 'Right',
    midline: [
      { name: 'Head', box: [38, 0, 24, 13.5] },
      { name: 'Neck', box: [43, 13.5, 14, 5.5] },
      { name: 'Abdomen', box: [31, 34.5, 38, 11.5] },
      { name: 'Groin', box: [36, 46, 28, 7.5] },
    ],
    sided: [
      { name: 'chest', box: [31, 19, 19, 15.5] },
      // Runs in to the neck to cover the top of the shoulder; the chest box wins where they overlap.
      { name: 'shoulder', box: [19, 14, 24, 10] },
      { name: 'upper arm', box: [15, 24, 15, 9] },
      { name: 'elbow', box: [13, 33, 15, 4.5] },
      { name: 'forearm', box: [9, 37.5, 17, 9] },
      { name: 'hand', box: [1, 46.5, 18, 11] },
      { name: 'hip', box: [27, 44, 9, 12] },
      { name: 'thigh', box: [26, 53, 22, 15] },
      { name: 'knee', box: [24, 68, 17, 8] },
      { name: 'lower leg', box: [23, 76, 16, 12] },
      { name: 'foot', box: [13, 88, 20, 12] },
    ],
  },
  back: {
    source: require('../../assets/images/body-back.png'),
    aspect: 238 / 544,
    viewerLeft: 'Left',
    midline: [
      { name: 'Back of head', box: [38, 0, 24, 10] },
      { name: 'Back of neck', box: [43, 10, 14, 6.5] },
      { name: 'Sacrum', box: [43, 42, 14, 11] },
    ],
    sided: [
      { name: 'upper back', box: [29, 16, 21, 15.5] },
      { name: 'shoulder', box: [19, 15, 10, 9] },
      { name: 'lower back', box: [29, 31.5, 21, 11.5] },
      { name: 'buttock', box: [27, 42, 23, 12] },
      { name: 'upper arm', box: [13, 24, 15, 10] },
      { name: 'elbow', box: [11, 34, 15, 4.5] },
      { name: 'forearm', box: [8, 38.5, 16, 9] },
      { name: 'back of hand', box: [1, 47, 17, 11] },
      { name: 'back of thigh', box: [26, 54, 23, 15] },
      { name: 'back of knee', box: [25, 69, 17, 6.5] },
      { name: 'calf', box: [24, 75.5, 17, 14] },
      { name: 'heel', box: [18, 89.5, 18, 10.5] },
    ],
  },
};

const VIEW_OPTIONS = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
] as const;

const sentence = (side: string, name: string) => `${side} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;

const regionsOf = ({ viewerLeft, midline, sided }: Figure) => {
  const viewerRight = viewerLeft === 'Right' ? 'Left' : 'Right';
  return [
    ...midline.map(({ name, box }) => ({ label: name, box })),
    ...sided.flatMap(({ name, box }) => {
      const [x, y, w, h] = box;
      return [
        { label: sentence(viewerLeft, name), box },
        { label: sentence(viewerRight, name), box: [100 - x - w, y, w, h] as Box },
      ];
    }),
  ];
};

const REGIONS: Record<BodyView, { label: string; box: Box }[]> = {
  front: regionsOf(FIGURES.front),
  back: regionsOf(FIGURES.back),
};

const regionAt = (view: BodyView, px: number, py: number) =>
  REGIONS[view].find(({ box: [x, y, w, h] }) => px >= x && px <= x + w && py >= y && py <= y + h)?.label;

interface Pin {
  view: BodyView;
  x: number;
  y: number;
  label: string;
}

/**
 * Front and back body map. Tapping a site reports its name ("Left calf") through `onSelect`; the
 * text field stays the record of truth, so the pin hides once the typed site no longer matches.
 */
export const BodyDiagram = ({ value, onSelect }: { value: string; onSelect: (label: string) => void }) => {
  const [view, setView] = useState<BodyView>('front');
  const [pin, setPin] = useState<Pin | null>(null);
  const [size, setSize] = useState({ width: FIGURE_WIDTH, height: FIGURE_WIDTH / FIGURES.front.aspect });
  const figureRef = useRef<HostInstance>(null);
  const figure = FIGURES[view];
  const viewerRight = figure.viewerLeft === 'Right' ? 'Left' : 'Right';

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const handlePress = (event: GestureResponderEvent) => {
    const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & { clientX?: number; clientY?: number };
    let x = native.locationX;
    let y = native.locationY;
    // react-native-web hands over the DOM event, whose coordinates are relative to the window.
    const node = figureRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    if (Platform.OS === 'web' && native.clientX !== undefined && node?.getBoundingClientRect) {
      const rect = node.getBoundingClientRect();
      x = native.clientX - rect.left;
      y = (native.clientY ?? 0) - rect.top;
    }
    const px = (x / size.width) * 100;
    const py = (y / size.height) * 100;
    const label = regionAt(view, px, py);
    if (!label) return;
    setPin({ view, x: px, y: py, label });
    onSelect(label);
  };

  const showPin = pin !== null && pin.view === view && value.trim().toLowerCase().startsWith(pin.label.toLowerCase());

  return (
    <View style={styles.wrap}>
      <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} accessibilityLabel="Body diagram view" />

      <View style={styles.card}>
        <View style={styles.stage}>
          <Text style={styles.side} accessibilityLabel={`Patient's ${figure.viewerLeft.toLowerCase()}`}>
            {figure.viewerLeft.charAt(0)}
          </Text>

          <Pressable
            ref={figureRef}
            onPress={handlePress}
            onLayout={onLayout}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Body diagram, ${view} view`}
            accessibilityHint="Tap where the wound is to fill in the location"
            style={[styles.figure, { aspectRatio: figure.aspect }]}
          >
            <Image source={figure.source} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
            {showPin && (
              <View pointerEvents="none" style={[styles.pinAnchor, { left: `${pin.x}%`, top: `${pin.y}%` }]}>
                <View style={styles.pinHalo} />
                <View style={styles.pinDot} />
              </View>
            )}
          </Pressable>

          <Text style={styles.side} accessibilityLabel={`Patient's ${viewerRight.toLowerCase()}`}>
            {viewerRight.charAt(0)}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{view === 'front' ? 'Front view' : 'Back view'}</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>{`Patient's ${figure.viewerLeft.toLowerCase()} is on your left`}</Text>
        </View>
      </View>
    </View>
  );
};


const PIN = 16;
const HALO = 34;

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 12,
  },
  card: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: '#243230',
    // A deep slate-teal so the figure's white fill stands out as a clear silhouette.
    backgroundColor: '#2F3E3C',
    overflow: 'hidden',
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
  },
  side: {
    width: 24,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  figure: {
    width: FIGURE_WIDTH,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // A zero-size anchor at the tap point; halo and dot are centered on it.
  pinAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHalo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: 'rgba(0, 91, 79, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0, 91, 79, 0.28)',
  },
  pinDot: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.surface,
    boxShadow: '0px 1px 3px rgba(17, 24, 39, 0.3)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#283634',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  footerDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
