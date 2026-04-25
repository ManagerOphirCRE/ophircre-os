import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ophircre.app',
  appName: 'OphirCRE',
  webDir: 'out', // Next.js static export directory
  server: {
    // This allows the native app to talk to your live Vercel/Supabase servers
    hostname: 'app.ophircre.com',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Camera: {
      // Requests native camera permissions for your Maintenance Barcode Scanner & Inspections
      permissions: {
        camera: "We need camera access to scan barcodes and take inspection photos.",
        photos: "We need photo library access to upload documents."
      }
    }
  }
};

export default config;