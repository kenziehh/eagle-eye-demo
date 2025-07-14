import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export const requestAllPermissions = async () => {
  await Camera.requestCameraPermissionsAsync();
  await Audio.requestPermissionsAsync();
};
