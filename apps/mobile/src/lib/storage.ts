import * as SecureStore from 'expo-secure-store';

export const storage = {
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error('Error setting item in secure storage', e);
    }
  },
  
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('Error getting item from secure storage', e);
      return null;
    }
  },
  
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('Error removing item from secure storage', e);
    }
  }
};
