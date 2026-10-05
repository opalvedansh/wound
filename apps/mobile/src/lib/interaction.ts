import {
  Platform,
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors } from './theme';

// react-native-web also reports hover and focus; native only reports `pressed`.
type WebPressState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

// Like CSS :focus-visible, focus rings only show when the last input came from the keyboard,
// so clicking a control doesn't leave a ring on it.
let keyboardModality = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', () => { keyboardModality = true; }, true);
  document.addEventListener('pointerdown', () => { keyboardModality = false; }, true);
}

export const focusStyles = StyleSheet.create({
  ring: {
    outlineColor: colors.accent,
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: 2,
  },
  inset: {
    outlineColor: colors.accent,
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: -2,
  },
});

/** Hover, press and focus styles for a Pressable's `style` callback. */
export const interactionStyle = (
  state: PressableStateCallbackType,
  hover: StyleProp<ViewStyle>,
  pressed: StyleProp<ViewStyle>,
  focus: StyleProp<ViewStyle> = focusStyles.ring,
): StyleProp<ViewStyle> => {
  const { hovered, focused } = state as WebPressState;
  return [hovered && hover, state.pressed && pressed, focused && keyboardModality && focus];
};

// Text fields draw their own focus ring, so the browser's default input outline is removed on web.
// React Native's types only list the outline styles native supports, hence the cast.
export const webInputReset: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
