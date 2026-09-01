import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import {
  Users, Wrench, ClipboardList, DollarSign, AlertTriangle, TrendingUp,
  ChevronLeft, ShieldCheck, Clock, Shield, Settings, FileText,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import type { Order, Dispute, Profile } from '@/types/database';

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [stats, setStats] = useState({
    totalCustomers: 0, totalTechnicians: 0, verifiedTechs: 0, pendingTechs: 0,
    totalOrders: 0, activeOrders: 0, completedOrders: 0, cancelledOrders: 0,
    totalRevenue: 0, platformCommission: 0, openDisputes: 0,
  bannedUsers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [pendingTechs, setPendingTechs] = useState<Profile[]>([]);
  const [openDisputes, setOpenDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { count: customers } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');
    const { count: techs } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician');
    const { count: verified } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'technician').eq('verification_status', 'approved');
    const { count: pending } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'technician').eq('verification_status', 'pending');
    const { count: banned } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'banned');
    const { count: totalOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true });
    const { count: activeOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("completed","cancelled")');
    const { count: completedOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    const { count: cancelledOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
    const { data: invoices } = await supabase.from('invoices').select('total, commission_amount, status');
    const totalRev = (invoices || []).reduce((sum, inv: any) => sum + Number(inv.total), 0);
    const totalComm = (invoices || []).reduce((sum, inv: any) => sum + Number(inv.commission_amount), 0);
    const { count: disputes } = await supabase
      .from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open');

    setStats({
      totalCustomers: customers || 0, totalTechnicians: techs || 0,
      verifiedTechs: verified || 0, pendingTechs: pending || 0,
      totalOrders: totalOrders || 0, activeOrders: activeOrders || 0,
      completedOrders: completedOrders || 0, cancelledOrders: cancelledOrders || 0,
      totalRevenue: totalRev, platformCommission: totalComm,
      openDisputes: disputes || 0, bannedUsers: banned || 0,
    });

    const { data: orders } = await supabase.from('orders').select(`
      *, service:services(*), customer:profiles!orders_customer_id_fkey(*),
      technician:profiles!orders_technician_id_fkey(*)
    `).order('created_at', { ascending: false }).limit(10);
    setRecentOrders((orders as Order[]) || []);

    const { data: pTechs } = await supabase.from('profiles').select('*')
      .eq('role', 'technician').eq('verification_status', 'pending')
      .order('created_at', { ascending: false }).limit(10);
    setPendingTechs((pTechs as Profile[]) || []);

    const { data: disp } = await supabase.from('disputes').select(`
      *, order:orders(*), invoice:invoices(*),
      customer:profiles!disputes_customer_id_fkey(*),
      technician:profiles!disputes_technician_id_fkey(*)
    `).eq('status', 'open').order('created_at', { ascending: false }).limit(10);
    setOpenDisputes((disp as Dispute[]) || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const verifyTech = async (tech: Profile, status: 'approved' | 'rejected') => {
  const { error } = await supabase
    .from('profiles')
    .update({
      verification_status: status,
    })
    .eq('id', tech.id);

  if (error) {
    show('فشل التحديث: ' + error.message, 'error');
  } else {
    show(status === 'approved' ? 'تم توثيق الفني وتفعيل حسابه' : 'تم رفض الفني', 'success');
    loadData();
  }
  };

  return (
    
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>لوحة التحكم الكاملة</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin/users')}>
            <Users color={colors.primary} size={22} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الحسابات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin/disputes')}>
            <AlertTriangle color={colors.error} size={22} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>النزاعات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin/support-config')}>
            <Settings color={colors.success} size={22} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>الإعدادات</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>الإحصائيات</Text>
        <View style={styles.statsGrid}>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users')}>
            <Users color="#2563eb" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalCustomers}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>الزبائن</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users')}>
            <Wrench color="#16a34a" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalTechnicians}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>الفنيون</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users')}>
            <ShieldCheck color="#10b981" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.verifiedTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>موثقون</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users')}>
            <Clock color="#f59e0b" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.pendingTechs}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>بانتظار التوثيق</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/orders' as any)}>
            <ClipboardList color="#6366f1" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalOrders}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>إجمالي الطلبات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/orders' as any)}>
            <TrendingUp color="#3b82f6" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.activeOrders}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>طلبات نشطة</Text>
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <DollarSign color="#ec4899" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.totalRevenue)}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>إجمالي الفواتير</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <TrendingUp color="#10b981" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(stats.platformCommission)}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>عمولة المنصة</Text>
          </View>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/disputes')}>
            <AlertTriangle color="#ef4444" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.openDisputes}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>نزاعات مفتوحة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/admin/users')}>
            <Shield color="#9ca3af" size={20} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.bannedUsers}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>حسابات محظورة</Text>
          </TouchableOpacity>
        </View>

        {pendingTechs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>فنيون بانتظار التوثيق</Text>
            {pendingTechs.map((tech) => (
              <View key={tech.id} style={[styles.techCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.techName, { color: colors.text }]}>{tech.full_name}</Text>
                  <Text style={[styles.techInfo, { color: colors.subtext }]}>{tech.specialty} • {tech.phone}</Text>
                </View>
                <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: colors.success + '20' }]} onPress={() => verifyTech(tech, 'approved')}>
                  <Text style={[styles.verifyText, { color: colors.success }]}>قبول</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: colors.error + '20' }]} onPress={() => verifyTech(tech, 'rejected')}>
                  <Text style={[styles.verifyText, { color: colors.error }]}>رفض</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {openDisputes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>نزاعات مفتوحة</Text>
            {openDisputes.map((dispute) => (
              <TouchableOpacity
                key={dispute.id}
                style={[styles.disputeRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push(`/dispute/${dispute.id}`)}
              >
                <AlertTriangle color="#ef4444" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.disputeReason, { color: colors.text }]} numberOfLines={1}>{dispute.reason}</Text>
                  <Text style={[styles.disputeTime, { color: colors.subtext }]}>{formatDateTime(dispute.created_at)}</Text>
                </View>
                <ChevronLeft color={colors.subtext} size={20} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>أحدث الطلبات</Text>
        {recentOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push(`/order/${order.id}`)}
          >
            <View style={[styles.orderDot, { backgroundColor: ORDER_STATUS_COLORS[order.status] }]} />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16, paddingBottom: 40 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 8, borderRadius: 14, padding: 16, borderWidth: 1 },
  quickBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '31%', flexGrow: 1, borderRadius: 14, padding: 14, borderWidth: 1, alignItems: 'center', gap: 6 },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 11, textAlign: 'center' },
  techCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  techInfo: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  verifyBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  verifyText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  disputeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  disputeReason: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  disputeTime: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
  orderService: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  orderCustomer: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderStatus: { fontFamily: 'Cairo-Medium', fontSize: 12 },
});
