import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast';
import { I18nManager, ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';

I18nManager.forceRTL(true);

function RootStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': Cairo_400Regular,
    'Cairo-Medium': Cairo_500Medium,
    'Cairo-SemiBold': Cairo_600SemiBold,
    'Cairo-Bold': Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // تسجيل رمز الإشعارات للهاتف عند فتح التطبيق والتأكد من تسجيل الدخول
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        registerForPushNotificationsAsync(user.id);
      }
    });
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="support" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="ledger" />
            <Stack.Screen name="dispute/[id]" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="admin/users" />
            <Stack.Screen name="admin/support-config" />
            <Stack.Screen name="admin/notifications" />
            <Stack.Screen name="chat/[orderId]" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <RootStatusBar />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
