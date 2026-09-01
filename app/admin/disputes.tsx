import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert,
} from 'react-native';
import { ChevronLeft, AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatDateTime, formatCurrency } from '@/lib/format';
import type { Dispute } from '@/types/database';

export default function AdminDisputesScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('disputes').select(`
      *, order:orders(*), invoice:invoices(*),
      customer:profiles!disputes_customer_id_fkey(*),
      technician:profiles!disputes_technician_id_fkey(*)
    `).order('created_at', { ascending: false });
    setDisputes((data as Dispute[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resolveDispute = (dispute: Dispute, resolution: 'resolved_customer' | 'resolved_technician') => {
    const label = resolution === 'resolved_customer' ? 'لصالح الزبون' : 'لصالح الفني';
    Alert.alert('حل النزاع', `هل تريد حل هذا النزاع ${label}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        onPress: async () => {
          const { error } = await supabase.from('disputes')
            .update({ status: resolution, resolved_at: new Date().toISOString() })
            .eq('id', dispute.id);
          if (error) {
            show('فشل حل النزاع', 'error');
            return;
          }
          if (dispute.invoice_id) {
            await supabase.from('invoices').update({
              locked: false,
              status: resolution === 'resolved_technician' ? 'paid' : 'cancelled',
              paid_at: resolution === 'resolved_technician' ? new Date().toISOString() : null,
            }).eq('id', dispute.invoice_id);
          }
          if (dispute.order_id) {
            await supabase.from('orders').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', dispute.order_id);
          }
          show('تم حل النزاع', 'success');
          loadData();
        },
      },
    ]);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'مفتوح';
      case 'resolved_customer': return 'محلول للزبون';
      case 'resolved_technician': return 'محلول للفني';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return colors.error;
      case 'resolved_customer':
      case 'resolved_technician': return colors.success;
      case 'cancelled': return colors.subtext;
      default: return colors.subtext;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة النزاعات</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        {loading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : disputes.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد نزاعات</Text>
        ) : (
          disputes.map((dispute) => (
            <View key={dispute.id} style={[styles.disputeCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.disputeHeader}>
                <AlertTriangle color={statusColor(dispute.status)} size={20} />
                <Text style={[styles.disputeReason, { color: colors.text }]} numberOfLines={2}>{dispute.reason}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(dispute.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(dispute.status) }]}>
                    {statusLabel(dispute.status)}
                  </Text>
                </View>
              </View>
              <View style={[styles.disputeInfo, { borderTopColor: colors.border }]}>
                <Text style={[styles.infoText, { color: colors.subtext }]}>
                  الزبون: {dispute.customer?.full_name || 'غير محدد'}
                </Text>
                <Text style={[styles.infoText, { color: colors.subtext }]}>
                  الفني: {dispute.technician?.full_name || 'غير محدد'}
                </Text>
                {dispute.invoice && (
                  <Text style={[styles.infoText, { color: colors.subtext }]}>
                    قيمة الفاتورة: {formatCurrency(dispute.invoice.total)}
                  </Text>
                )}
                <Text style={[styles.infoText, { color: colors.subtext }]}>
                  التاريخ: {formatDateTime(dispute.created_at)}
                </Text>
              </View>
              {dispute.status === 'open' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success + '15' }]}
                    onPress={() => resolveDispute(dispute, 'resolved_customer')}
                  >
                    <CheckCircle color={colors.success} size={16} />
                    <Text style={[styles.actionText, { color: colors.success }]}>لصالح الزبون</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => resolveDispute(dispute, 'resolved_technician')}
                  >
                    <XCircle color={colors.primary} size={16} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>لصالح الفني</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
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
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  disputeCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  disputeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disputeReason: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 14 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  disputeInfo: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 4 },
  infoText: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
});
