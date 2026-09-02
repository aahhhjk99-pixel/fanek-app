import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ActivityIndicator, View } from 'react-native';
import { Home, ClipboardList, User, Wallet, LayoutDashboard, LifeBuoy } from 'lucide-react-native';

export default function TabLayout() {
  const { profile, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return <Redirect href="/(auth)/" />;
  }

  const role = profile.role;

  const ALL_TAB_NAMES = ['index', 'orders', 'wallet-tab', 'support-tab', 'profile'];
  const tabs: any[] = [];

  if (role === 'customer') {
    tabs.push(
      { name: 'index', title: 'الرئيسية', icon: Home },
      { name: 'orders', title: 'طلباتي', icon: ClipboardList },
      { name: 'support-tab', title: 'الدعم', icon: LifeBuoy },
      { name: 'profile', title: 'حسابي', icon: User }
    );
  } else if (role === 'technician') {
    tabs.push(
      { name: 'index', title: 'الرئيسية', icon: Home },
      { name: 'orders', title: 'الطلبات', icon: ClipboardList },
      { name: 'wallet-tab', title: 'المحفظة', icon: Wallet },
      { name: 'support-tab', title: 'الدعم', icon: LifeBuoy },
      { name: 'profile', title: 'حسابي', icon: User }
    );
  } else if (role === 'admin') {
    tabs.push(
      { name: 'index', title: 'الرئيسية', icon: LayoutDashboard },
      { name: 'orders', title: 'الطلبات', icon: ClipboardList },
      { name: 'support-tab', title: 'الدعم', icon: LifeBuoy },
      { name: 'profile', title: 'حسابي', icon: User }
    );
  }

  const shownNames = new Set(tabs.map((t) => t.name));
  const hiddenNames = ALL_TAB_NAMES.filter((n) => !shownNames.has(n));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarLabelStyle: {
          fontFamily: 'Cairo-Medium',
          fontSize: 12,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
      }}
    >
      {tabs.map((tab: any) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <tab.icon color={color} size={size} />
            ),
          }}
        />
      ))}
      {hiddenNames.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
