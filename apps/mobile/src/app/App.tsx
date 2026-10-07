import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startSyncEngine } from '../lib/syncManager';

import { LoginScreen } from '../screens/LoginScreen';
import { PatientListScreen } from '../screens/PatientListScreen';
import { PatientIntakeScreen } from '../screens/PatientIntakeScreen';
import { CaseDetailScreen } from '../screens/CaseDetailScreen';
import { ClinicalAssessmentScreen } from '../screens/ClinicalAssessmentScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { CaptureGuideScreen } from '../screens/CaptureGuideScreen';
import { AIResultScreen } from '../screens/AIResultScreen';

// Missing M01-M19 screens added
import { PatientScreen } from '../screens/PatientScreen';
import { NewCaseScreen } from '../screens/NewCaseScreen';
import { TreatmentDetailScreen } from '../screens/TreatmentDetailScreen';
import { PhaseOverviewScreen } from '../screens/PhaseOverviewScreen';
import { ImageReviewScreen } from '../screens/ImageReviewScreen';
import { AIProcessingScreen } from '../screens/AIProcessingScreen';
import { ReportBuilderScreen } from '../screens/ReportBuilderScreen';
import { ReportPreviewScreen } from '../screens/ReportPreviewScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { SyncStatusScreen } from '../screens/SyncStatusScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AccountSettingsScreen } from '../screens/AccountSettingsScreen';
import { TherapyTrackingScreen } from '../screens/TherapyTrackingScreen';

const Stack = createNativeStackNavigator();

export const App = () => {
  React.useEffect(() => {
    // Start background sync polling when the app loads
    startSyncEngine();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          {/* M01 Login */}
          <Stack.Screen name="Login" component={LoginScreen} />
          
          {/* M02 Home / Patient List */}
          <Stack.Screen name="PatientList" component={PatientListScreen} />
          
          {/* M03 Patient Intake */}
          <Stack.Screen name="PatientIntake" component={PatientIntakeScreen} options={{ presentation: 'modal' }} />
          
          {/* M04 Patient Page */}
          <Stack.Screen name="Patient" component={PatientScreen} />
          
          {/* M05 New Case */}
          <Stack.Screen name="NewCase" component={NewCaseScreen} options={{ presentation: 'modal' }} />
          
          {/* M06 Case Detail */}
          <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
          
          {/* M07 Treatment Detail */}
          <Stack.Screen name="TreatmentDetail" component={TreatmentDetailScreen} />
          
          {/* M08 Phase Overview */}
          <Stack.Screen name="PhaseOverview" component={PhaseOverviewScreen} />
          
          {/* M09 Clinical Questions */}
          <Stack.Screen name="ClinicalAssessment" component={ClinicalAssessmentScreen} />
          
          {/* Post-Wound Care / Therapy */}
          <Stack.Screen name="TherapyTracking" component={TherapyTrackingScreen} />

          {/* M10 Image Capture */}
          <Stack.Screen name="Camera" component={CameraScreen} options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="CaptureGuide" component={CaptureGuideScreen} options={{ presentation: 'modal' }} />
          
          {/* M11 Image Review / Quality */}
          <Stack.Screen name="ImageReview" component={ImageReviewScreen} />
          
          {/* M12 AI Processing */}
          <Stack.Screen name="AIProcessing" component={AIProcessingScreen} />
          
          {/* M13 Result */}
          <Stack.Screen name="AIResult" component={AIResultScreen} />
          
          {/* M14 Report Builder */}
          <Stack.Screen name="ReportBuilder" component={ReportBuilderScreen} />
          
          {/* M15 Report Preview */}
          <Stack.Screen name="ReportPreview" component={ReportPreviewScreen} />
          
          {/* M16 Share */}
          <Stack.Screen name="Share" component={ShareScreen} options={{ presentation: 'modal' }} />
          
          {/* M17 Sync Status */}
          <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ presentation: 'modal' }} />
          
          {/* M18 Search */}
          <Stack.Screen name="Search" component={SearchScreen} />
          
          {/* M19 Account / Settings */}
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
          
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
