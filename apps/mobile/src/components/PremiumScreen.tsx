import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp, SafeAreaView } from 'react-native';
import { colors, spacing } from '../lib/theme';

interface PremiumScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ children, scrollable = false, style, noPadding = false }) => {
  const contentStyle = [styles.content, noPadding && { paddingHorizontal: 0 }, style];

  return (
    <SafeAreaView style={styles.safeArea}>
      {scrollable ? (
        <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  }
});
