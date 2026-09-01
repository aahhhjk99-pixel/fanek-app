import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import CustomerHome from '@/components/CustomerHome';
import TechnicianHome from '@/components/TechnicianHome';
import AdminHome from '@/components/AdminHome';
import { View, ActivityIndicator } from 'react-native';

export default function HomeScreen() {
  const { profile, loading } = useAuth();
  const { colors } = useTheme();

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profile.role === 'customer') return <CustomerHome />;
  if (profile.role === 'technician') return <TechnicianHome />;
  if (profile.role === 'admin') return <AdminHome />;
  return <CustomerHome />;
}
