import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft, Search, Ban, CheckCircle, Trash2, Users, Wrench, UserCircle, Percent, Wallet, PlusCircle,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency } from '@/lib/format';
import type { Profile } from '@/types/database';

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // حالة مودال تعديل نسبة العمولة
  const [selectedTech, setSelectedTech] = useState<Profile | null>(null);
  const [newCommission, setNewCommission] = useState('');
  const [updatingCommission, setUpdatingCommission] = useState(false);

  // حالة مودال شحن رصيد المحفظة
  const [selectedTechForWallet, setSelectedTechForWallet] = useState<Profile | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [updatingWallet, setUpdatingWallet] = useState(false);

  const loadUsers = useCallback(async () => {
    let query = supabase.from('profiles').select('*');
    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }
    query = query.order('created_at', { ascending: false });
    const { data } = await query;
    setUsers((data as Profile[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || (u.phone || '').includes(q);
  });

  // دالة الحظر والفك
  const handleBan = (user: Profile) => {
    const currentlyBanned = user.account_status === 'banned' || (user as any).is_banned === true;
    const action = currentlyBanned ? 'فك الحظر' : 'حظر';

    Alert.alert(action, `هل تريد ${action} "${user.full_name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: action,
        style: currentlyBanned ? 'default' : 'destructive',
        onPress: async () => {
          const newStatus = currentlyBanned ? 'active' : 'banned';
          const isBannedVal = !currentlyBanned;

          const { error } = await supabase
            .from('profiles')
            .update({ 
              account_status: newStatus,
              is_banned: isBannedVal 
            })
            .eq('id', user.id);

          if (error) {
            Alert.alert('خطأ', error.message);
          } else {
            loadUsers();
          }
        },
      },
    ]);
  };

  // دالة الحذف
  const handleDelete = (user: Profile) => {
    Alert.alert(
      'حذف حساب',
      `هل أنت متأكد من حذف حساب "${user.full_name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token;
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
              
              let deleted = false;

              if (supabaseUrl && token) {
                try {
                  const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ userId: user.id }),
                  });
                  const result = await response.json();
                  if (response.ok && !result.error) {
                    deleted = true;
                  }
                } catch (e) {
                  // Fallback to direct DB delete
                }
              }

              if (!deleted) {
                const { error: deleteError } = await supabase
                  .from('profiles')
                  .delete()
                  .eq('id', user.id);

                if (deleteError) throw deleteError;
              }

              loadUsers();
            } catch (err: any) {
              Alert.alert('خطأ', err.message || 'فشل حذف الحساب');
            }
          },
        },
      ]
    );
  };

  // حفظ نسبة العمولة الجديدة للفني
  const handleUpdateCommission = async () => {
    if (!selectedTech) return;
    const rate = parseFloat(newCommission);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('خطأ', 'يرجى إدخال نسبة مئوية صحيحة بين 0 و 100');
      return;
    }

    setUpdatingCommission(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ commission_rate: rate })
        .eq('id', selectedTech.id);

      if (error) throw error;

      Alert.alert('نجاح', `تم تحديث نسبة العمولة إلى ${rate}% بنجاح`);
      setSelectedTech(null);
      loadUsers();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setUpdatingCommission(false);
    }
  };

  // شحن رصيد المحفظة للفني
  const handleRechargeWallet = async () => {
    if (!selectedTechForWallet) return;
    const amount = parseFloat(rechargeAmount);

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('خطأ', 'يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    setUpdatingWallet(true);
    try {
      const techId = selectedTechForWallet.id;
      const currentProfileBalance = (selectedTechForWallet as any).wallet_balance ?? 0;
      const newProfileBalance = currentProfileBalance + amount;

      // 1. تحديث الرصيد في جدول profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ wallet_balance: newProfileBalance })
        .eq('id', techId);

      if (profileError) throw profileError;

      // 2. تحديث أو إضافة السجل في جدول wallets
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('technician_id', techId)
        .maybeSingle();

      if (existingWallet) {
        const { error: walletError } = await supabase
          .from('wallets')
          .update({ balance: (existingWallet.balance ?? 0) + amount })
          .eq('technician_id', techId);
        if (walletError) throw walletError;
      } else {
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({
            technician_id: techId,
            balance: amount,
            total_earnings: 0,
            total_commission: 0,
          });
        if (walletError) throw walletError;
      }

      Alert.alert('نجاح', `تم شحن ${formatCurrency(amount)} إلى محفظة الفني بنجاح`);
      setSelectedTechForWallet(null);
      setRechargeAmount('');
      loadUsers();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء شحن الرصيد');
    } finally {
      setUpdatingWallet(false);
    }
  };

  const roleLabel = (role: string) => role === 'customer' ? 'زبون' : role === 'technician' ? 'فني' : 'أدمن';
  const roleColor = (role: string) => role === 'customer' ? colors.primary : role === 'technician' ? colors.success : colors.error;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الحسابات والعمولات</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search color={colors.subtext} size={18} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="بحث بالاسم أو الهاتف..."
            placeholderTextColor={colors.subtext}
          />
        </View>
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'customer', label: 'الزبائن' },
            { id: 'technician', label: 'الفنيون' },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, { backgroundColor: roleFilter === f.id ? colors.primary : colors.chipBg, borderColor: colors.border }]}
              onPress={() => setRoleFilter(f.id)}
            >
              <Text style={[styles.filterText, { color: roleFilter === f.id ? '#fff' : colors.chipText }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadUsers} />}
      >
        {loading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : filteredUsers.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد حسابات</Text>
        ) : (
          filteredUsers.map((user) => {
            const isBanned = user.account_status === 'banned' || (user as any).is_banned === true;
            const rColor = roleColor(user.role);
            const currentCommission = (user as any).commission_rate ?? 10.0;
            const currentBalance = (user as any).wallet_balance ?? 0;

            return (
              <View key={user.id} style={[styles.userCard, { backgroundColor: colors.cardBg, borderColor: isBanned ? colors.error + '40' : colors.border }]}>
                <View style={styles.userHeader}>
                  <View style={[styles.avatar, { backgroundColor: rColor + '20' }]}>
                    {user.role === 'customer' ? (
                      <UserCircle color={rColor} size={28} />
                    ) : user.role === 'technician' ? (
                      <Wrench color={rColor} size={24} />
                    ) : (
                      <Users color={rColor} size={24} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{user.full_name}</Text>
                    <Text style={[styles.userPhone, { color: colors.subtext }]}>{user.phone || 'لا يوجد رقم'}</Text>
                    <View style={styles.userMeta}>
                      <View style={[styles.roleBadge, { backgroundColor: rColor + '20' }]}>
                        <Text style={[styles.roleText, { color: rColor }]}>{roleLabel(user.role)}</Text>
                      </View>
                      {user.role === 'technician' && (
                        <View style={[styles.roleBadge, { backgroundColor: (user.verification_status === 'approved' ? colors.success : user.verification_status === 'pending' ? colors.warning : colors.error) + '20' }]}>
                          <Text style={[styles.roleText, { color: user.verification_status === 'approved' ? colors.success : user.verification_status === 'pending' ? colors.warning : colors.error }]}>
                            {user.verification_status === 'approved' ? 'موثق' : user.verification_status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                          </Text>
                        </View>
                      )}
                      {isBanned && (
                        <View style={[styles.bannedBadge, { backgroundColor: colors.error + '20' }]}>
                          <Ban color={colors.error} size={12} />
                          <Text style={[styles.bannedText, { color: colors.error }]}>محظور</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.userDate, { color: colors.subtext }]}>عضو منذ {formatDate(user.created_at)}</Text>
                  </View>
                </View>

                {/* قسم تفاصيل الرصيد والعمولة المخصص للفنيين */}
                {user.role === 'technician' && (
                  <View style={[styles.techDetailsContainer, { borderTopColor: colors.border }]}>
                    <View style={styles.commissionRow}>
                      <View style={styles.commissionBadge}>
                        <Percent color={colors.primary} size={14} />
                        <Text style={[styles.commissionLabel, { color: colors.subtext }]}>العمولة:</Text>
                        <Text style={[styles.commissionValue, { color: colors.primary }]}>{currentCommission}%</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.editCommissionBtn, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => {
                          setSelectedTech(user);
                          setNewCommission(currentCommission.toString());
                        }}
                      >
                        <Text style={[styles.editCommissionText, { color: colors.primary }]}>تعديل النسبة</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.commissionRow}>
                      <View style={styles.commissionBadge}>
                        <Wallet color={colors.success} size={14} />
                        <Text style={[styles.commissionLabel, { color: colors.subtext }]}>الرصيد:</Text>
                        <Text style={[styles.commissionValue, { color: currentBalance > 0 ? colors.success : colors.error }]}>
                          {formatCurrency(currentBalance)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.editCommissionBtn, { backgroundColor: colors.success + '15' }]}
                        onPress={() => {
                          setSelectedTechForWallet(user);
                          setRechargeAmount('');
                        }}
                      >
                        <PlusCircle color={colors.success} size={12} />
                        <Text style={[styles.editCommissionText, { color: colors.success }]}>شحن الرصيد</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {user.role !== 'admin' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isBanned ? colors.success + '15' : colors.error + '15' }]}
                      onPress={() => handleBan(user)}
                    >
                      {isBanned ? <CheckCircle color={colors.success} size={16} /> : <Ban color={colors.error} size={16} />}
                      <Text style={[styles.actionText, { color: isBanned ? colors.success : colors.error }]}>
                        {isBanned ? 'فك الحظر' : 'حظر'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.error + '10' }]}
                      onPress={() => handleDelete(user)}
                    >
                      <Trash2 color={colors.error} size={16} />
                      <Text style={[styles.actionText, { color: colors.error }]}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* نافذة تعديل العمولة (Modal) */}
      <Modal visible={!!selectedTech} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>تعديل نسبة عمولة الفني</Text>
            <Text style={[styles.modalSub, { color: colors.subtext }]}>
              الفني: {selectedTech?.full_name}
            </Text>

            <View style={[styles.inputBox, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                keyboardType="numeric"
                value={newCommission}
                onChangeText={setNewCommission}
                placeholder="أدخل النسبة (مثلاً 10)"
                placeholderTextColor={colors.subtext}
              />
              <Text style={{ color: colors.subtext, fontFamily: 'Cairo-Bold' }}>%</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => setSelectedTech(null)}
              >
                <Text style={{ color: colors.text, fontFamily: 'Cairo-Bold' }}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleUpdateCommission}
                disabled={updatingCommission}
              >
                {updatingCommission ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo-Bold' }}>حفظ التغيير</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* نافذة شحن رصيد المحفظة (Modal) */}
      <Modal visible={!!selectedTechForWallet} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>شحن رصيد محفظة الفني</Text>
            <Text style={[styles.modalSub, { color: colors.subtext }]}>
              الفني: {selectedTechForWallet?.full_name}
            </Text>

            <View style={[styles.inputBox, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                keyboardType="numeric"
                value={rechargeAmount}
                onChangeText={setRechargeAmount}
                placeholder="أدخل قيمة الشحن (مثلاً 50)"
                placeholderTextColor={colors.subtext}
              />
              <Text style={{ color: colors.subtext, fontFamily: 'Cairo-Bold' }}>د.ل</Text>
            </View>

            {/* أزرار سريعة للشحن */}
            <View style={styles.quickAmountsRow}>
              {[10, 20, 50, 100].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.quickAmountBtn, { backgroundColor: colors.primary + '15' }]}
                  onPress={() => setRechargeAmount(amt.toString())}
                >
                  <Text style={{ color: colors.primary, fontFamily: 'Cairo-Bold', fontSize: 12 }}>+{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => setSelectedTechForWallet(null)}
              >
                <Text style={{ color: colors.text, fontFamily: 'Cairo-Bold' }}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.success }]}
                onPress={handleRechargeWallet}
                disabled={updatingWallet}
              >
                {updatingWallet ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo-Bold' }}>تأكيد الشحن</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  filterText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  body: { padding: 16, paddingBottom: 40 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  userCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  userHeader: { flexDirection: 'row', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  userName: { fontFamily: 'Cairo-SemiBold', fontSize: 15 },
  userPhone: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  userMeta: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  bannedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bannedText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  userDate: { fontFamily: 'Cairo-Regular', fontSize: 11, marginTop: 6 },
  techDetailsContainer: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commissionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commissionLabel: { fontFamily: 'Cairo-Regular', fontSize: 12 },
  commissionValue: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  editCommissionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editCommissionText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopColor: '#e5e7eb', borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, textAlign: 'center' },
  modalSub: { fontFamily: 'Cairo-Regular', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, marginBottom: 12 },
  modalInput: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 16, textAlign: 'right' },
  quickAmountsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  quickAmountBtn: { flex: 1, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
