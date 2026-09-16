import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export const uploadImageToSupabase = async (uri: string, path: string): Promise<string | null> => {
  try {
    if (!uri.startsWith('file://')) {
      return uri; // Already uploaded or mock
    }

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage
      .from('images')
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    return path;
  } catch (error) {
    console.error('Exception during image upload:', error);
    return null;
  }
};
