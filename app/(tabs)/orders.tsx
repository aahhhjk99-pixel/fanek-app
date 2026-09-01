import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Linking,
} from 'react-native';
import { MessageCircle, Phone } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import { getServiceIcon } from '@/components/ServiceIcon';
import type { Order } from '@/types/database';

export default function OrdersScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    let query = supabase.from('orders').select(`
      *,
      service:services(*),
      customer:profiles!orders_customer_id_fkey(*),
      technician:profiles!orders_technician_id_fkey(*)
    `);

    if (profile.role === 'customer') {
      query = query.eq('customer_id', profile.id);
    } else if (profile.role === 'technician') {
      query = query.eq('technician_id', profile.id);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['completed', 'cancelled'].includes(o.status);
    if (filter === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {profile?.role === 'customer' ? 'طلباتي' : profile?.role === 'technician' ? 'الطلبات' : 'كل الطلبات'}
        </Text>
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'نشطة' },
            { id: 'completed', label: 'مكتملة' },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, { backgroundColor: colors.chipBg, borderColor: colors.border }, filter === f.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, { color: colors.chipText }, filter === f.id && { color: colors.chipActiveText }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrders} />}
      >
        {loading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد طلبات</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const Icon = getServiceIcon(order.service?.icon || 'wrench');
            const statusColor = ORDER_STATUS_COLORS[order.status];
            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => router.push(`/order/${order.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.orderHeader}>
                  <View style={[styles.orderIconBox, { backgroundColor: colors.iconBg }]}>
                    <Icon color={colors.primary} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderService, { color: colors.text }]} numberOfLines={1}>
                      {order.service?.name || 'خدمة'}
                    </Text>
                    <Text style={[styles.orderTime, { color: colors.subtext }]}>{timeAgo(order.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Text>
                  </View>
                </View>
                <View style={[styles.orderDetails, { borderTopColor: colors.border }]}>
                  {profile?.role !== 'customer' && order.customer && (
                    <Text style={[styles.orderDetailText, { color: colors.subtext }]}>الزبون: {order.customer.full_name}</Text>
                  )}
                  {profile?.role !== 'technician' && order.technician && (
                    <Text style={[styles.orderDetailText, { color: colors.subtext }]}>الفني: {order.technician.full_name}</Text>
                  )}
                  {order.location_address ? (
                    <Text style={[styles.orderDetailText, { color: colors.subtext }]}>الموقع: {order.location_address}</Text>
                  ) : null}
                </View>
                {order.technician_id && (
                  <View style={styles.orderActions}>
                    <TouchableOpacity
                      style={[styles.chatBtn, { backgroundColor: colors.primaryLight }]}
                      onPress={() => router.push(`/chat/${order.id}` as any)}
                    >
                      <MessageCircle color={colors.primary} size={16} />
                      <Text style={[styles.chatBtnText, { color: colors.primary }]}>محادثة</Text>
                    </TouchableOpacity>
                    {((profile?.role === 'customer' && order.technician) ||
                      (profile?.role === 'technician' && order.customer)) && (
                      <TouchableOpacity
                        style={[styles.callBtnSmall, { backgroundColor: colors.success + '15' }]}
                        onPress={() => {
                          const phone = profile?.role === 'customer'
                            ? order.technician?.phone
                            : order.customer?.phone;
                          if (phone) Linking.openURL(`tel:${phone}`);
                        }}
                      >
                        <Phone color={colors.success} size={16} />
                        <Text style={[styles.callBtnText, { color: colors.success }]}>اتصال</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 22, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  filterText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  body: { padding: 16, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 15 },
  orderCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  orderIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  orderService: { fontFamily: 'Cairo-SemiBold', fontSize: 15 },
  orderTime: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  orderDetails: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  orderDetailText: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  orderActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chatBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  callBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  callBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
});
