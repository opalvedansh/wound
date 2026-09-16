import React, { useState, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

export const ImageCaptureScreen = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!permission) {
    return <View style={styles.safe}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', marginBottom: 20 }}>We need your permission to show the camera</Text>
          <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true });
        navigation.navigate('ImageReviewScreen', { photoUri: photo.uri, photoBase64: photo.base64 });
      } catch (err) {
        console.error('Failed to take picture:', err);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="x" size={28} color="#fff" /></TouchableOpacity>
        <Feather name="zap-off" size={24} color="#fff" />
      </View>
      
      <View style={styles.cameraContainer}>
        <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back">
          <View style={styles.framingGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.calibrationBadge}>
            <View style={styles.dot} />
            <Text style={styles.calibrationText}>Searching for Calibration Marker</Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.footer}>
        <View style={styles.instructions}>
          <Text variant="bodyMedium" style={{color:'#fff', textAlign:'center'}}>Frame wound within the guide</Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity><Feather name="image" size={28} color="#fff" /></TouchableOpacity>
          <TouchableOpacity style={styles.captureButtonOuter} onPress={takePicture} disabled={isCapturing}>
            {isCapturing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
          <TouchableOpacity><Feather name="refresh-ccw" size={28} color="#fff" /></TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, zIndex: 10 },
  cameraContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  framingGuide: { width: width - 80, height: width - 80, position: 'absolute', top: '20%' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: colors.accent, borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  calibrationBadge: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginRight: 8 },
  calibrationText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  footer: { paddingBottom: spacing.xxl, paddingTop: spacing.lg, backgroundColor: '#000' },
  instructions: { marginBottom: spacing.xl },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  captureButtonOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureButtonInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' }
});