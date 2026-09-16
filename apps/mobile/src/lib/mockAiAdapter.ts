export const mockAiAdapter = {
  detectCalibrationSticker: async (imageUri?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Simulate processing time
      setTimeout(() => {
        // Return true roughly 80% of the time in the mock
        resolve(Math.random() > 0.2);
      }, 2000);
    });
  },

  checkImageQuality: async (imageUri?: string): Promise<{
    passed: boolean;
    lightingScore: number;
    blurScore: number;
    reason?: string;
  }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const lightingScore = Math.random() * 100;
        const blurScore = Math.random() * 100;
        
        // Pass if lighting > 30 and blur > 30
        const passed = lightingScore > 30 && blurScore > 30;
        
        resolve({
          passed,
          lightingScore,
          blurScore,
          reason: passed ? undefined : (lightingScore <= 30 ? 'Image is too dark' : 'Image is too blurry')
        });
      }, 1000);
    });
  }
};
