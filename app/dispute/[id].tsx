import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { ChevronLeft, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatDateTime, formatCurrency } from '@/lib/format';
import type { Dispute } from '@/types/database';

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { show } = useToast();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('disputes').select(`
      *, order:orders(*), invoice:invoices(*),
      customer:profiles!disputes_customer_id_fkey(*),
      technician:profiles!disputes_technician_id_fkey(*)
    `).eq('id', id).maybeSingle();
    setDispute(data as Dispute | null);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const resolveDispute = (resolution: 'resolved_customer' | 'resolved_technician') => {
    if (!dispute) return;
    const label = resolution === 'resolved_customer' ? 'لصالح الزبون' : 'لصالح الفني';
    Alert.alert('حل النزاع', `حل هذا النزاع ${label}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        onPress: async () => {
          const { error } = await supabase.from('disputes')
            .update({ status: resolution, resolved_at: new Date().toISOString() })
            .eq('id', dispute.id);
          if (error) {
            show('فشل', 'error');
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.subtext }}>جاري التحميل...</Text>
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.subtext }}>النزاع غير موجود</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusLabel = dispute.status === 'open' ? 'مفتوح' :
    dispute.status === 'resolved_customer' ? 'محلول للزبون' :
    dispute.status === 'resolved_technician' ? 'محلول للفني' : 'ملغي';
  const statusColor = dispute.status === 'open' ? colors.error :
    dispute.status === 'cancelled' ? colors.subtext : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تفاصيل النزاع</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.statusCard, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
          <AlertTriangle color={statusColor} size={24} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>سبب الاعتراض</Text>
          <Text style={[styles.reasonText, { color: colors.subtext }]}>{dispute.reason}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>الأطراف</Text>
          <View style={styles.partyRow}>
            <Text style={[styles.partyLabel, { color: colors.subtext }]}>الزبون:</Text>
            <Text style={[styles.partyValue, { color: colors.text }]}>{dispute.customer?.full_name || 'غير محدد'}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={[styles.partyLabel, { color: colors.subtext }]}>الفني:</Text>
            <Text style={[styles.partyValue, { color: colors.text }]}>{dispute.technician?.full_name || 'غير محدد'}</Text>
          </View>
        </View>

        {dispute.invoice && (
          <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.sectionRow}>
              <FileText color={colors.primary} size={20} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>الفاتورة</Text>
            </View>
            <Text style={[styles.invoiceText, { color: colors.subtext }]}>
              الإجمالي: {formatCurrency(dispute.invoice.total)}
            </Text>
            <Text style={[styles.invoiceText, { color: colors.subtext }]}>
              العمولة: {formatCurrency(dispute.invoice.commission_amount)}
            </Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>التاريخ</Text>
          <Text style={[styles.dateText, { color: colors.subtext }]}>{formatDateTime(dispute.created_at)}</Text>
        </View>

        {dispute.status === 'open' && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: colors.success + '15' }]} onPress={() => resolveDispute('resolved_customer')}>
              <CheckCircle color={colors.success} size={18} />
              <Text style={[styles.resolveBtnText, { color: colors.success }]}>حل لصالح الزبون</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: colors.primary + '15' }]} onPress={() => resolveDispute('resolved_technician')}>
              <XCircle color={colors.primary} size={18} />
              <Text style={[styles.resolveBtnText, { color: colors.primary }]}>حل لصالح الفني</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16, paddingBottom: 40 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  statusText: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  section: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 16, marginBottom: 8 },
  reasonText: { fontFamily: 'Cairo-Regular', fontSize: 14, lineHeight: 22 },
  partyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  partyLabel: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  partyValue: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  invoiceText: { fontFamily: 'Cairo-Regular', fontSize: 14, paddingVertical: 2 },
  dateText: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  actions: { gap: 10, marginTop: 8 },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  resolveBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
});
