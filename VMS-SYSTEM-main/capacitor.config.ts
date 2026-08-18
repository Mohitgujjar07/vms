import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.vidyavahini.vms',
  appName: 'Vidyavahini VMS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
