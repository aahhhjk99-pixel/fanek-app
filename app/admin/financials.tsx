import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft, DollarSign, FileText, RotateCcw, X, ArrowUpRight, CheckCircle2
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';

interface OrderFinancial {
  id: string;
  total_price: number;
  commission_amount: number;
  created_at: string;
  status: string;
}

export default function AdminFinancialsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // المبالغ الحالية
  const [totalProfits, setTotalProfits] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // تواريخ التصفير
  const [profitsResetAt, setProfitsResetAt] = useState<string>('1970-01-01');
  const [invoicesResetAt, setInvoicesResetAt] = useState<string>('1970-01-01');

  // تفاصيل المودال
  const [activeModal, setActiveModal] = useState<'profits' | 'invoices' | null>(null);
  const [ordersList, setOrdersList] = useState<OrderFinancial[]>([]);
  const [resetting, setResetting] = useState(false);

  const loadFinancialData = useCallback(async () => {
    try {
      // 1. جلب تواريخ آخر تصفير
      const { data: resetData } = await supabase
        .from('admin_financial_resets')
        .select('*')
        .eq('id', 1)
        .single();

      const pReset = resetData?.profits_reset_at || '1970-01-01T00:00:00Z';
      const iReset = resetData?.invoices_reset_at || '1970-01-01T00:00:00Z';

      setProfitsResetAt(pReset);
      setInvoicesResetAt(iReset);

      // 2. جلب الطلبات المكتملة للحساب
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total_price, commission_amount, created_at, status')
        .eq('status', 'completed');

      if (error) throw error;

      // حساب أرباح المنصة (منذ آخر تصفير للأرباح)
      const calculatedProfits = (orders || [])
        .filter((o) => new Date(o.created_at) > new Date(pReset))
        .reduce((sum, o) => sum + (Number(o.commission_amount) || 0), 0);

      // حساب إجمالي الفواتير (منذ آخر تصفير للفواتير)
      const calculatedInvoices = (orders || [])
        .filter((o) => new Date(o.created_at) > new Date(iReset))
        .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

      setTotalProfits(calculatedProfits);
      setTotalInvoices(calculatedInvoices);
      setOrdersList(orders || []);
    } catch (err: any) {
      show('فشل تحميل البيانات المالية', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  // دالة تصفير العداد
  const handleResetCounter = (type: 'profits' | 'invoices') => {
    const title = type === 'profits' ? 'تصفير أرباح المنصة' : 'تصفير إجمالي الفواتير';
    Alert.alert(
      title,
      'هل أنت متأكد من رغبتك في تصفير العداد؟ سيتم إعادة العداد المالي إلى 0.00 د.ل دون حذف الفواتير القديمة.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تصفير الآن',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const now = new Date().toISOString();
              const updatePayload =
                type === 'profits'
                  ? { profits_reset_at: now }
                  : { invoices_reset_at: now };

              const { error } = await supabase
                .from('admin_financial_resets')
                .update(updatePayload)
                .eq('id', 1);

              if (error) throw error;

              show('تم تصفير العداد بنجاح', 'success');
              setActiveModal(null);
              loadFinancialData();
            } catch (err: any) {
              show(err.message || 'حدث خطأ أثناء تصفير العداد', 'error');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  // تصفية السجلات المعروضة داخل المودال حسب تاريخ التصفير
  const filteredModalOrders = ordersList.filter((o) => {
    const resetDate = activeModal === 'profits' ? profitsResetAt : invoicesResetAt;
    return new Date(o.created_at) > new Date(resetDate);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>المالية والأرباح</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadFinancialData} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.cardsContainer}>
            {/* كارت أرباح المنصة */}
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => setActiveModal('profits')}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                  <DollarSign color="#15803d" size={24} />
                </View>
                <ArrowUpRight color={colors.subtext} size={20} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.subtext }]}>أرباح المنصة الحالية</Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>{totalProfits.toFixed(2)} د.ل</Text>
              <Text style={[styles.clickHint, { color: colors.primary }]}>اضغط للتحكم والتفاصيل ←</Text>
            </TouchableOpacity>

            {/* كارت إجمالي الفواتير */}
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => setActiveModal('invoices')}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                  <FileText color="#0369a1" size={24} />
                </View>
                <ArrowUpRight color={colors.subtext} size={20} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.subtext }]}>إجمالي الفواتير</Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>{totalInvoices.toFixed(2)} د.ل</Text>
              <Text style={[styles.clickHint, { color: colors.primary }]}>اضغط للتحكم والتفاصيل ←</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* مودال العرض والتصفير */}
      <Modal visible={!!activeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            {/* رأس المودال */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <X color={colors.text} size={22} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {activeModal === 'profits' ? 'تفاصيل أرباح المنصة' : 'تفاصيل إجمالي الفواتير'}
              </Text>
              <View style={{ width: 22 }} />
            </View>

            {/* زر تصفير العداد */}
            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: colors.error + '15' }]}
              onPress={() => activeModal && handleResetCounter(activeModal)}
              disabled={resetting}
            >
              {resetting ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <>
                  <RotateCcw color={colors.error} size={18} />
                  <Text style={[styles.resetBtnText, { color: colors.error }]}>تصفير هذا العداد</Text>
                </>
              )}
            </TouchableOpacity>

            {/* قائمة الفواتير / الأرباح */}
            <ScrollView contentContainerStyle={styles.modalList}>
              {filteredModalOrders.length === 0 ? (
                <Text style={[styles.emptyModalText, { color: colors.subtext }]}>لا توجد سجلات بعد آخر تصفير</Text>
              ) : (
                filteredModalOrders.map((item) => (
                  <View key={item.id} style={[styles.orderRow, { borderColor: colors.border }]}>
                    <View style={styles.orderRowInfo}>
                      <CheckCircle2 size={16} color={colors.success} />
                      <Text style={[styles.orderIdText, { color: colors.text }]}>طلب #{item.id.slice(0, 8)}</Text>
                    </View>
                    <Text style={[styles.orderAmountText, { color: colors.primary }]}>
                      {activeModal === 'profits'
                        ? `${(item.commission_amount || 0).toFixed(2)} د.ل (عمولة)`
                        : `${(item.total_price || 0).toFixed(2)} د.ل`}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16 },
  cardsContainer: { gap: 14 },
  statCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  cardValue: { fontFamily: 'Cairo-Bold', fontSize: 22 },
  clickHint: { fontFamily: 'Cairo-Bold', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%', gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10 },
  resetBtnText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  modalList: { paddingVertical: 10, gap: 10 },
  emptyModalText: { fontFamily: 'Cairo-Medium', fontSize: 13, textAlign: 'center', marginVertical: 30 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 10 },
  orderRowInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderIdText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  orderAmountText: { fontFamily: 'Cairo-Bold', fontSize: 13 },
});
