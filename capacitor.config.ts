import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.554115e23c57412f9ebccca0052def51',
  appName: 'nexoraainew',
  webDir: 'dist',
  server: {
    url: 'https://554115e2-3c57-412f-9ebc-cca0052def51.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
