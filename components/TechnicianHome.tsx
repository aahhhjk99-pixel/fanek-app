import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert,
} from 'react-native';
import {
  MapPin, Star, ChevronLeft, Clock, AlertCircle, CheckCircle, Wrench, ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { getServiceIcon } from '@/components/ServiceIcon';
import { formatCurrency, calculateDistance, timeAgo } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, BRAND_NAME, BRAND_LOGO, WARRANTY_TEXT } from '@/lib/constants';
import type { Order, Wallet } from '@/types/database';

export default function TechnicianHome() {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('technician_id', profile.id)
      .maybeSingle();
    setWallet(walletData as Wallet | null);

    const { data: active } = await supabase
      .from('orders')
      .select(`*, service:services(*), customer:profiles!orders_customer_id_fkey(*)`)
      .eq('technician_id', profile.id)
      .in('status', ['accepted', 'en_route', 'arrived', 'in_progress', 'work_done', 'invoice_issued', 'awaiting_payment'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveOrder(active as Order | null);

    if (profile.technician_status === 'available' && (walletData?.balance ?? 0) > 0) {
      const { data: newOrders } = await supabase
        .from('orders')
        .select(`*, service:services(*), customer:profiles!orders_customer_id_fkey(*)`)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20);
      setAvailableOrders((newOrders as Order[]) || []);
    } else {
      setAvailableOrders([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleStatus = async () => {
    if (!profile) return;
    const newStatus = profile.technician_status === 'available' ? 'offline' : 'available';
    if ((wallet?.balance ?? 0) <= 0 && newStatus === 'available') {
      Alert.alert('تنبيه', 'رصيد محفظتك صفر. لا يمكنك استقبال طلبات جديدة. تواصل مع الدعم لشحن محفظتك.');
      return;
    }
    await supabase.from('profiles').update({ technician_status: newStatus }).eq('id', profile.id);
    await refreshProfile();
  };

  const acceptOrder = async (order: Order) => {
    if (!profile) return;
    const dist = profile.location_lat && order.location_lat
      ? calculateDistance(profile.location_lat, profile.location_lng!, order.location_lat, order.location_lng!)
      : null;
    const { data: accepted, error } = await supabase.from('orders').update({
      technician_id: profile.id, status: 'accepted', accepted_at: new Date().toISOString(), distance_km: dist,
    }).eq('id', order.id).eq('status', 'new').select('id').maybeSingle();

    if (error || !accepted) {
      Alert.alert('تعذر قبول الطلب', 'تم قبول هذا الطلب من فني آخر للتو.');
      loadData();
      return;
    }

    await supabase.from('profiles').update({ technician_status: 'busy' }).eq('id', profile.id);
    await refreshProfile();
    loadData();
    router.push(`/order/${order.id}` as any);
  };

  const isAvailable = profile?.technician_status === 'available';
  const balance = wallet?.balance ?? 0;
  const isBlocked = balance <= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.subtext }]}>مرحباً،</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || 'فني'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.brandBadge, { backgroundColor: colors.primaryLight }]}>
              <Star color={colors.primary} size={14} fill={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>{BRAND_NAME} {BRAND_LOGO}</Text>
            </View>
            <ThemeToggle compact />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.statusToggle, isAvailable ? styles.statusAvailable : styles.statusOffline]}
          onPress={toggleStatus}
        >
          <View style={[styles.statusDot, { backgroundColor: isAvailable ? '#22c55e' : colors.statusDot }]} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isAvailable ? '🟢 متاح' : '⚫ غير متصل'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        {profile?.verification_status === 'pending' && (
          <View style={[styles.pendingBanner, { backgroundColor: colors.promoBg, borderColor: colors.promoBorder }]}>
            <Clock color={colors.accent} size={20} />
            <Text style={[styles.pendingText, { color: colors.promoText }]}>
              حسابك قيد المراجعة من قبل الأدمن. سيتم تفعيلك بعد التوثيق.
            </Text>
          </View>
        )}

        {profile?.verification_status === 'rejected' && (
          <View style={[styles.rejectedBanner, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]}>
            <AlertCircle color={colors.error} size={20} />
            <Text style={[styles.rejectedText, { color: colors.error }]}>
              تم رفض حسابك. تواصل مع الدعم لمزيد من المعلومات.
            </Text>
          </View>
        )}

        <View style={[styles.walletMiniCard, { backgroundColor: colors.walletCardBg }]}>
          <View style={styles.walletInfo}>
            <Text style={[styles.walletLabel, { color: 'rgba(255,255,255,0.8)' }]}>رصيد المحفظة</Text>
            <Text style={[styles.walletBalance, { color: colors.walletCardText }]}>{formatCurrency(balance)}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/wallet' as any)}>
            <ChevronLeft color={colors.walletCardText} size={20} />
          </TouchableOpacity>
        </View>

        {isBlocked && (
          <View style={[styles.blockedBanner, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]}>
            <AlertCircle color={colors.error} size={20} />
            <Text style={[styles.blockedText, { color: colors.error }]}>
              رصيدك صفر - لا يمكنك استقبال طلبات جديدة
            </Text>
          </View>
        )}

        {activeOrder && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>الطلب الحالي</Text>
            <TouchableOpacity
              style={[styles.activeOrderCard, { backgroundColor: colors.cardBg, borderColor: colors.primary }]}
              onPress={() => router.push(`/order/${activeOrder.id}` as any)}
            >
              <View style={styles.activeOrderHeader}>
                <View style={[styles.activeOrderIcon, { backgroundColor: colors.primary }]}>
                  <Wrench color="#fff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activeOrderService, { color: colors.text }]}>{activeOrder.service?.name}</Text>
                  <Text style={[styles.activeOrderCustomer, { color: colors.subtext }]}>{activeOrder.customer?.full_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: ORDER_STATUS_COLORS[activeOrder.status] + '20' }]}>
                  <Text style={[styles.statusTextBadge, { color: ORDER_STATUS_COLORS[activeOrder.status] }]}>
                    {ORDER_STATUS_LABELS[activeOrder.status]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </>
        )}

        {!activeOrder && isAvailable && !isBlocked && profile?.verification_status === 'approved' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>طلبات متاحة ({availableOrders.length})</Text>
            {loading ? (
              <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري التحميل...</Text>
            ) : availableOrders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد طلبات جديدة حالياً</Text>
                <Text style={[styles.emptySubtext, { color: colors.subtext }]}>اسحب للتحديث للبحث عن طلبات جديدة</Text>
              </View>
            ) : (
              availableOrders.map((order) => {
                const Icon = getServiceIcon(order.service?.icon || 'wrench');
                const dist = profile?.location_lat && order.location_lat
                  ? calculateDistance(profile.location_lat, profile.location_lng!, order.location_lat, order.location_lng!)
                  : null;
                return (
                  <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.orderHeader}>
                      <View style={[styles.orderIconBox, { backgroundColor: colors.iconBg }]}>
                        <Icon color={colors.primary} size={20} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.orderService, { color: colors.text }]}>{order.service?.name}</Text>
                        <Text style={[styles.orderTime, { color: colors.subtext }]}>{timeAgo(order.created_at)}</Text>
                      </View>
                    </View>
                    <View style={[styles.orderDetails, { borderTopColor: colors.border }]}>
                      <View style={styles.orderDetailRow}>
                        <MapPin color={colors.subtext} size={14} />
                        <Text style={[styles.orderDetailText, { color: colors.subtext }]}>{order.location_address || 'غير محدد'}</Text>
                      </View>
                      {dist && (
                        <View style={styles.orderDetailRow}>
                          <Text style={[styles.distText, { color: colors.primary }]}>على بعد {dist} كم</Text>
                        </View>
                      )}
                      {order.description ? (
                        <Text style={[styles.orderDesc, { color: colors.text }]} numberOfLines={2}>{order.description}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.warrantyNote, { backgroundColor: colors.success + '12' }]}>
                      <ShieldCheck color={colors.success} size={14} />
                      <Text style={[styles.warrantyNoteText, { color: colors.success }]}>يلتزم بضمان 3 أيام على الصيانة</Text>
                    </View>
                    <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.success }]} onPress={() => acceptOrder(order)}>
                      <CheckCircle color="#fff" size={18} />
                      <Text style={styles.acceptBtnText}>قبول الطلب</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {!isAvailable && !activeOrder && profile?.verification_status === 'approved' && (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>أنت غير متصل</Text>
            <Text style={[styles.emptySubtext, { color: colors.subtext }]}>فعّل حالة "متاح" لاستقبال الطلبات</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  brandText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  greeting: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  userName: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  statusAvailable: { backgroundColor: '#dcfce7' },
  statusOffline: { backgroundColor: '#f3f4f6' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  body: { padding: 16, paddingBottom: 40 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  pendingText: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 20 },
  rejectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  rejectedText: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 20 },
  walletMiniCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, padding: 20, marginBottom: 16 },
  walletInfo: {},
  walletLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, marginBottom: 4 },
  walletBalance: { fontFamily: 'Cairo-Bold', fontSize: 24 },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  blockedText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 13 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12 },
  activeOrderCard: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 2 },
  activeOrderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeOrderIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  activeOrderService: { fontFamily: 'Cairo-SemiBold', fontSize: 15 },
  activeOrderCustomer: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusTextBadge: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  loadingText: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontFamily: 'Cairo-Medium', fontSize: 16 },
  emptySubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 4 },
  orderCard: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  orderIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orderService: { fontFamily: 'Cairo-SemiBold', fontSize: 15 },
  orderTime: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  orderDetails: { borderTopWidth: 1, paddingTop: 10, marginBottom: 12, gap: 6 },
  orderDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderDetailText: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  distText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  orderDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 20 },
  warrantyNote: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  warrantyNoteText: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  acceptBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14, color: '#fff' },
});
