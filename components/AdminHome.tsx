import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import {
  Users, Wrench, ClipboardList, DollarSign, AlertTriangle, TrendingUp,
  ChevronLeft, ShieldCheck, Clock, Star,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, BRAND_NAME, BRAND_LOGO } from '@/lib/constants';
import type { Order, Dispute, Profile } from '@/types/database';

export default function AdminHome() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState({
    totalUsers: 0, verifiedTechs: 0, pendingTechs: 0, todayOrders: 0,
    totalInvoices: 0, platformRevenue: 0, openDisputes: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [pendingTechs, setPendingTechs] = useState<Profile[]>([]);
  const [openDisputes, setOpenDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { count: usersCount } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');
    const { count: verifiedCount } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'technician').eq('verification_status', 'approved');
    const { count: pendingCount } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'technician').eq('verification_status', 'pending');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayOrdersCount } = await supabase
      .from('orders').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    const { data: invoices } = await supabase.from('invoices').select('total, commission_amount, status');
    const totalInv = (invoices || []).reduce((sum, inv: any) => sum + Number(inv.total), 0);
    const totalComm = (invoices || []).reduce((sum, inv: any) => sum + Number(inv.commission_amount), 0);
    const { count: disputesCount } = await supabase
      .from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open');

    setStats({
      totalUsers: usersCount || 0, verifiedTechs: verifiedCount || 0, pendingTechs: pendingCount || 0,
      todayOrders: todayOrdersCount || 0, totalInvoices: totalInv, platformRevenue: totalComm,
      openDisputes: disputesCount || 0,
    });

    const { data: orders } = await supabase.from('orders').select(`
      *, service:services(*), customer:profiles!orders_customer_id_fkey(*),
      technician:profiles!orders_technician_id_fkey(*)
    `).order('created_at', { ascending: false }).limit(5);
    setRecentOrders((orders as Order[]) || []);

    const { data: techs } = await supabase.from('profiles').select('*')
      .eq('role', 'technician').eq('verification_status', 'pending')
      .order('created_at', { ascending: false }).limit(5);
    setPendingTechs((techs as Profile[]) || []);

    const { data: disputes } = await supabase.from('disputes').select(`
      *, order:orders(*), invoice:invoices(*),
      customer:profiles!disputes_customer_id_fkey(*),
      technician:profiles!disputes_technician_id_fkey(*)
    `).eq('status', 'open').order('created_at', { ascending: false }).limit(5);
    setOpenDisputes((disputes as Dispute[]) || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>لوحة التحكم</Text>
            <Text style={[styles.headerSub, { color: colors.subtext }]}>إدارة شاملة للنظام</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.brandBadge, { backgroundColor: colors.primaryLight }]}>
              <Star color={colors.primary} size={14} fill={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>{BRAND_NAME} {BRAND_LOGO}</Text>
            </View>
            <ThemeToggle compact />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={styles.statsGrid}>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users' as any)}>
            <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
              <Users color="#2563eb" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalUsers}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>الزبائن</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users' as any)}>
            <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
              <ShieldCheck color="#16a34a" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.verifiedTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>فنيون موثقون</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users' as any)}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Clock color="#f59e0b" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.pendingTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>بانتظار التوثيق</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/orders' as any)}>
            <View style={[styles.statIcon, { backgroundColor: '#e0e7ff' }]}>
              <ClipboardList color="#6366f1" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.todayOrders}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>طلبات اليوم</Text>
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#fce7f3' }]}>
              <DollarSign color="#ec4899" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.totalInvoices)}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>إجمالي الفواتير</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: '#d1fae5' }]}>
              <TrendingUp color="#10b981" size={20} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.platformRevenue)}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>أرباح المنصة</Text>
          </View>
        </View>

        {stats.openDisputes > 0 && (
          <TouchableOpacity style={[styles.alertBanner, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]} activeOpacity={0.7} onPress={() => router.push('/admin/disputes' as any)}>
            <AlertTriangle color={colors.error} size={20} />
            <Text style={[styles.alertText, { color: colors.error }]}>
              {stats.openDisputes} نزاع مفتوح يحتاج للتحكيم
            </Text>
            <ChevronLeft color={colors.error} size={20} />
          </TouchableOpacity>
        )}

        {pendingTechs.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>فنيون بانتظار المراجعة</Text>
            </View>
            {pendingTechs.map((tech) => (
              <TouchableOpacity
                key={tech.id}
                style={[styles.techRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push('/admin/users' as any)}
              >
                <View style={[styles.techAvatar, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.techInitial, { color: '#92400e' }]}>{tech.full_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.techName, { color: colors.text }]}>{tech.full_name}</Text>
                  <Text style={[styles.techInfo, { color: colors.subtext }]}>{tech.specialty} • {tech.phone}</Text>
                </View>
                <Clock color={colors.warning} size={20} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {openDisputes.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>نزاعات مفتوحة</Text>
            </View>
            {openDisputes.map((dispute) => (
              <TouchableOpacity
                key={dispute.id}
                style={[styles.disputeRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push(`/dispute/${dispute.id}` as any)}
              >
                <View style={[styles.disputeIcon, { backgroundColor: '#fee2e2' }]}>
                  <AlertTriangle color="#ef4444" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.disputeReason, { color: colors.text }]} numberOfLines={1}>{dispute.reason}</Text>
                  <Text style={[styles.disputeTime, { color: colors.subtext }]}>{formatDateTime(dispute.created_at)}</Text>
                </View>
                <ChevronLeft color={colors.subtext} size={20} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>أحدث الطلبات</Text>
        </View>
        {recentOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push(`/order/${order.id}` as any)}
          >
            <View style={[styles.orderStatusDot, { backgroundColor: ORDER_STATUS_COLORS[order.status] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderService, { color: colors.text }]}>{order.service?.name}</Text>
              <Text style={[styles.orderCustomer, { color: colors.subtext }]}>
                {order.customer?.full_name} → {order.technician?.full_name || 'غير محدد'}
              </Text>
            </View>
            <Text style={[styles.orderStatus, { color: ORDER_STATUS_COLORS[order.status] }]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.fullDashboardBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/admin' as any)}
        >
          <Text style={styles.fullDashboardBtnText}>فتح لوحة التحكم الكاملة</Text>
          <ChevronLeft color="#fff" size={20} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  brandText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 24 },
  headerSub: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 4 },
  body: { padding: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { width: '48%', flexGrow: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  alertText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18 },
  techRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  techAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  techInitial: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  techInfo: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  disputeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  disputeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  disputeReason: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  disputeTime: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  orderStatusDot: { width: 10, height: 10, borderRadius: 5 },
  orderService: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  orderCustomer: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderStatus: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  fullDashboardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, marginTop: 16 },
  fullDashboardBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
});
