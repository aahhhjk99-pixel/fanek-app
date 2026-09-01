import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft, Smartphone, Check, X, Clock, AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { RechargeRequest, RechargeCompany } from '@/types/database';

export default function AdminRechargesScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('recharge_requests')
      .select(`
        *, technician:profiles!recharge_requests_technician_id_fkey(*)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    setRequests((data as RechargeRequest[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const approveRequest = async (req: RechargeRequest) => {
    if (!profile) return;
    setProcessing(req.id);
    try {
      const { data, error } = await supabase.rpc('approve_recharge', {
        p_request_id: req.id,
        p_admin_id: profile.id,
      });
      if (error) throw new Error(error.message);
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'فشل الموافقة');
      show('تمت الموافقة وإضافة الرصيد بنجاح', 'success');
      loadData();
    } catch (err: any) {
      show(err.message || 'فشل الموافقة', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const rejectRequest = async (req: RechargeRequest) => {
    if (!profile) return;
    setProcessing(req.id);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ status: 'rejected', reviewed_by: profile.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw new Error(error.message);
      show('تم رفض الطلب', 'success');
      loadData();
    } catch (err: any) {
      show(err.message || 'فشل الرفض', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const companyLabel = (c: RechargeCompany) => c === 'libyana' ? 'ليبيانا' : 'المدار';
  const statusLabels: Record<string, string> = { pending: 'قيد المراجعة', approved: 'تمت الموافقة', rejected: 'مرفوض' };
  const statusColors: Record<string, string> = { pending: '#f59e0b', approved: '#16a34a', rejected: '#ef4444' };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>طلبات الشحن المعلقة</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        {loading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : pendingRequests.length === 0 && processedRequests.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد طلبات شحن</Text>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>طلبات معلقة ({pendingRequests.length})</Text>
                {pendingRequests.map((req) => (
                  <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.requestHeader}>
                      <View style={[styles.companyBadge, { backgroundColor: req.company === 'libyana' ? '#dcfce7' : '#dbeafe' }]}>
                        <Smartphone color={req.company === 'libyana' ? '#16a34a' : '#2563eb'} size={16} />
                        <Text style={[styles.companyText, { color: req.company === 'libyana' ? '#16a34a' : '#2563eb' }]}>
                          {companyLabel(req.company)}
                        </Text>
                      </View>
                      <Text style={[styles.valueText, { color: colors.text }]}>{formatCurrency(req.voucher_value)}</Text>
                    </View>

                    <View style={[styles.codeBox, { backgroundColor: colors.inputBg }]}>
                      <Text style={[styles.codeLabel, { color: colors.subtext }]}>كود التعبئة:</Text>
                      <Text style={[styles.codeValue, { color: colors.text }]} selectable>{req.voucher_code}</Text>
                    </View>

                    <View style={styles.requestInfo}>
                      <Text style={[styles.techName, { color: colors.text }]}>{req.technician?.full_name || 'غير معروف'}</Text>
                      <Text style={[styles.requestDate, { color: colors.subtext }]}>{formatDateTime(req.created_at)}</Text>
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: colors.success }]}
                        onPress={() => approveRequest(req)}
                        disabled={processing === req.id}
                        activeOpacity={0.85}
                      >
                        {processing === req.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Check color="#fff" size={18} />
                            <Text style={styles.actionBtnText}>موافقة وإضافة الرصيد</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, { backgroundColor: colors.error + '15', borderColor: colors.error }]}
                        onPress={() => rejectRequest(req)}
                        disabled={processing === req.id}
                        activeOpacity={0.85}
                      >
                        <X color={colors.error} size={18} />
                        <Text style={[styles.rejectBtnText, { color: colors.error }]}>رفض</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {processedRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>طلبات تمت معالجتها</Text>
                {processedRequests.map((req) => (
                  <View key={req.id} style={[styles.processedCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={styles.processedHeader}>
                      <View style={[styles.companyBadge, { backgroundColor: req.company === 'libyana' ? '#dcfce7' : '#dbeafe' }]}>
                        <Smartphone color={req.company === 'libyana' ? '#16a34a' : '#2563eb'} size={14} />
                        <Text style={[styles.companyText, { color: req.company === 'libyana' ? '#16a34a' : '#2563eb', fontSize: 12 }]}>
                          {companyLabel(req.company)}
                        </Text>
                      </View>
                      <Text style={[styles.valueText, { color: colors.text, fontSize: 14 }]}>{formatCurrency(req.voucher_value)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColors[req.status] + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColors[req.status] }]}>{statusLabels[req.status]}</Text>
                      </View>
                    </View>
                    <Text style={[styles.techName, { color: colors.subtext, fontSize: 13 }]}>{req.technician?.full_name || 'غير معروف'}</Text>
                    <Text style={[styles.requestDate, { color: colors.subtext }]}>{formatDateTime(req.created_at)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
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
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12, marginTop: 8 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  requestCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  companyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  companyText: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  valueText: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  codeBox: { borderRadius: 10, padding: 12, marginBottom: 12 },
  codeLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 4 },
  codeValue: { fontFamily: 'Cairo-Bold', fontSize: 18, letterSpacing: 2 },
  requestInfo: { marginBottom: 12 },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  requestDate: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  actionBtnText: { fontFamily: 'Cairo-Bold', fontSize: 13, color: '#fff' },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1 },
  rejectBtnText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  processedCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  processedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto' },
  statusText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
});
