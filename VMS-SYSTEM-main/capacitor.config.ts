import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.vidyavahini.vms',
  appName: 'Vidyavahini VMS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2200,
      launchAutoHide: true,
      backgroundColor: "#150a2a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    }
  }
};

export default config;
