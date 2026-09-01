import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Wallet as WalletIcon, TrendingUp, Receipt, ChevronLeft, AlertCircle, Plus, Smartphone } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { CURRENCY } from '@/lib/constants';
import type { Wallet, LedgerEntry, RechargeRequest, RechargeCompany } from '@/types/database';

const VOUCHER_VALUES = [5, 10, 20, 50, 100];

export default function WalletTabScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { show } = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showTopup, setShowTopup] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<RechargeCompany>('libyana');
  const [selectedValue, setSelectedValue] = useState(20);
  const [voucherCode, setVoucherCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('technician_id', profile.id)
      .maybeSingle();
    setWallet(walletData as Wallet | null);

    const { data: ledgerData } = await supabase
      .from('financial_ledger')
      .select('*')
      .eq('technician_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setLedger((ledgerData as LedgerEntry[]) || []);

    const { data: rechargeData } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('technician_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecharges((rechargeData as RechargeRequest[]) || []);

    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const balance = wallet?.balance ?? 0;
  const isBlocked = balance <= 0;

  const submitTopup = async () => {
    if (!profile) return;
    if (!voucherCode.trim()) {
      show('أدخل كود التعبئة', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('recharge_requests').insert({
        technician_id: profile.id,
        company: selectedCompany,
        voucher_value: selectedValue,
        voucher_code: voucherCode.trim(),
        status: 'pending',
      });
      if (error) throw new Error(error.message);
      show('تم إرسال طلب الشحن للمراجعة', 'success');
      setShowTopup(false);
      setVoucherCode('');
      loadData();
    } catch (err: any) {
      show(err.message || 'فشل إرسال الطلب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const companyLabel = (c: RechargeCompany) => c === 'libyana' ? 'ليبيانا' : 'المدار';
  const rechargeStatusLabels: Record<string, string> = {
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
  };
  const rechargeStatusColors: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#16a34a',
    rejected: '#ef4444',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>محفظتي</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={[styles.balanceCard, { backgroundColor: colors.walletCardBg }]}>
          <View style={styles.balanceRow}>
            <WalletIcon color="rgba(255,255,255,0.8)" size={24} />
            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: colors.walletCardText }]}>{formatCurrency(balance)}</Text>
          {isBlocked && (
            <View style={styles.blockedBanner}>
              <AlertCircle color="#fff" size={16} />
              <Text style={styles.blockedText}>
                رصيدك صفر - لا يمكنك استقبال طلبات جديدة
              </Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <TrendingUp color="rgba(255,255,255,0.7)" size={16} />
              <Text style={styles.statLabel}>إجمالي الأرباح</Text>
              <Text style={styles.statValue}>{formatCurrency(wallet?.total_earnings ?? 0)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Receipt color="rgba(255,255,255,0.7)" size={16} />
              <Text style={styles.statLabel}>إجمالي العمولات</Text>
              <Text style={styles.statValue}>{formatCurrency(wallet?.total_commission ?? 0)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.topupBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowTopup(true)}
          activeOpacity={0.85}
        >
          <Plus color="#fff" size={20} />
          <Text style={styles.topupBtnText}>شحن الرصيد عبر كارت تعبئة</Text>
        </TouchableOpacity>

        {recharges.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>طلبات الشحن</Text>
            {recharges.map((req) => (
              <View key={req.id} style={[styles.rechargeCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.rechargeIcon, { backgroundColor: req.company === 'libyana' ? '#dcfce7' : '#dbeafe' }]}>
                  <Smartphone color={req.company === 'libyana' ? '#16a34a' : '#2563eb'} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rechargeCompany, { color: colors.text }]}>{companyLabel(req.company)} • {formatCurrency(req.voucher_value)}</Text>
                  <Text style={[styles.rechargeCode, { color: colors.subtext }]} numberOfLines={1}>كود: {req.voucher_code}</Text>
                  <Text style={[styles.rechargeDate, { color: colors.subtext }]}>{formatDateTime(req.created_at)}</Text>
                </View>
                <View style={[styles.rechargeStatusBadge, { backgroundColor: rechargeStatusColors[req.status] + '20' }]}>
                  <Text style={[styles.rechargeStatusText, { color: rechargeStatusColors[req.status] }]}>
                    {rechargeStatusLabels[req.status]}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>السجل المالي</Text>
          <TouchableOpacity onPress={() => router.push('/ledger' as any)}>
            <Text style={[styles.viewAllText, { color: colors.primary }]}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : ledger.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد حركات مالية</Text>
        ) : (
          ledger.slice(0, 20).map((entry) => {
            const isPositive = entry.amount > 0;
            const typeLabels: Record<string, string> = {
              earnings: 'أرباح',
              commission: 'عمولة',
              signup_bonus: 'مكافأة تسجيل',
              admin_credit: 'شحن من الأدمن',
              admin_debit: 'خصم من الأدمن',
              payout: 'سحب',
              recharge: 'شحن محفظة',
            };
            return (
              <View key={entry.id} style={[styles.ledgerCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.ledgerIcon, { backgroundColor: isPositive ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={styles.ledgerIconText}>{isPositive ? '+' : '-'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ledgerType, { color: colors.text }]}>{typeLabels[entry.type] || entry.type}</Text>
                  <Text style={[styles.ledgerDate, { color: colors.subtext }]}>{formatDateTime(entry.created_at)}</Text>
                  {entry.description ? (
                    <Text style={[styles.ledgerDesc, { color: colors.subtext }]} numberOfLines={1}>{entry.description}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.ledgerAmount, { color: isPositive ? colors.success : colors.error }]}>
                    {isPositive ? '+' : ''}{formatCurrency(Math.abs(entry.amount))}
                  </Text>
                  <Text style={[styles.ledgerBalance, { color: colors.subtext }]}>{formatCurrency(entry.balance_after)}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Top-up Modal */}
      <Modal visible={showTopup} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>شحن المحفظة</Text>
              <TouchableOpacity onPress={() => setShowTopup(false)}>
                <Text style={[styles.modalClose, { color: colors.subtext }]}>إغلاق</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.text }]}>اختر شركة الاتصالات</Text>
            <View style={styles.companyRow}>
              <TouchableOpacity
                style={[styles.companyBtn, { borderColor: selectedCompany === 'libyana' ? '#16a34a' : colors.border }, selectedCompany === 'libyana' && { backgroundColor: '#dcfce7' }]}
                onPress={() => setSelectedCompany('libyana')}
              >
                <Smartphone color="#16a34a" size={20} />
                <Text style={[styles.companyBtnText, { color: colors.text }]}>ليبيانا</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.companyBtn, { borderColor: selectedCompany === 'al_madar' ? '#2563eb' : colors.border }, selectedCompany === 'al_madar' && { backgroundColor: '#dbeafe' }]}
                onPress={() => setSelectedCompany('al_madar')}
              >
                <Smartphone color="#2563eb" size={20} />
                <Text style={[styles.companyBtnText, { color: colors.text }]}>المدار</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.text }]}>قيمة الكارت</Text>
            <View style={styles.valuesRow}>
              {VOUCHER_VALUES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.valueBtn, { borderColor: selectedValue === v ? colors.primary : colors.border }, selectedValue === v && { backgroundColor: colors.primary }]}
                  onPress={() => setSelectedValue(v)}
                >
                  <Text style={[styles.valueBtnText, { color: selectedValue === v ? '#fff' : colors.text }]}>{v} {CURRENCY}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.text }]}>كود التعبئة</Text>
            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              value={voucherCode}
              onChangeText={setVoucherCode}
              placeholder="أدخل كود الكارت"
              placeholderTextColor={colors.subtext}
              keyboardType="number-pad"
            />

            <Text style={[styles.modalNote, { color: colors.subtext }]}>
              سيتم مراجعة طلبك من قبل الأدمن وإضافة الرصيد عند الموافقة
            </Text>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && styles.submitBtnDisabled]}
              onPress={submitTopup}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>إرسال طلب الشحن</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 22 },
  body: { padding: 16, paddingBottom: 40 },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balanceLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  balanceAmount: { fontFamily: 'Cairo-Bold', fontSize: 36, marginBottom: 16 },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.3)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  blockedText: { fontFamily: 'Cairo-Medium', fontSize: 12, color: '#fff', flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff', marginTop: 4 },
  topupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 24 },
  topupBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12 },
  viewAllText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  rechargeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  rechargeIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rechargeCompany: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  rechargeCode: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  rechargeDate: { fontFamily: 'Cairo-Regular', fontSize: 11, marginTop: 2 },
  rechargeStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  rechargeStatusText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  ledgerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  ledgerIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ledgerIconText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#374151' },
  ledgerType: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  ledgerDate: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  ledgerDesc: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  ledgerAmount: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  ledgerBalance: { fontFamily: 'Cairo-Regular', fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  modalClose: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  modalLabel: { fontFamily: 'Cairo-Medium', fontSize: 14, marginBottom: 10, marginTop: 8 },
  companyRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  companyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, borderWidth: 2 },
  companyBtnText: { fontFamily: 'Cairo-SemiBold', fontSize: 15 },
  valuesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  valueBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 2 },
  valueBtnText: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  codeInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Cairo-Regular', fontSize: 16, borderWidth: 1, marginBottom: 12 },
  modalNote: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 16, textAlign: 'center' },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
});
