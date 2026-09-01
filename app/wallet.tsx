import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, Wallet as WalletIcon, TrendingUp, Receipt } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/format';
import type { Wallet } from '@/types/database';

export default function WalletScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('wallets').select('*').eq('technician_id', profile.id).maybeSingle();
    setWallet(data as Wallet | null);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const balance = wallet?.balance ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>المحفظة</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        <View style={[styles.balanceCard, { backgroundColor: colors.walletCardBg }]}>
          <View style={styles.balanceRow}>
            <WalletIcon color="rgba(255,255,255,0.8)" size={24} />
            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: colors.walletCardText }]}>{formatCurrency(balance)}</Text>
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

        <TouchableOpacity style={[styles.ledgerBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/ledger')}>
          <Receipt color={colors.primary} size={22} />
          <Text style={[styles.ledgerBtnText, { color: colors.text }]}>عرض السجل المالي الكامل</Text>
        </TouchableOpacity>

        {loading && <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري التحميل...</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16 },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balanceLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  balanceAmount: { fontFamily: 'Cairo-Bold', fontSize: 36, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  statLabel: { fontFamily: 'Cairo-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statValue: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff', marginTop: 4 },
  ledgerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, borderWidth: 1 },
  ledgerBtnText: { fontFamily: 'Cairo-Medium', fontSize: 15 },
  loadingText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', marginTop: 20 },
});
