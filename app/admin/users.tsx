import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Alert, TextInput,
} from 'react-native';
import {
  ChevronLeft, Search, Ban, CheckCircle, Trash2, Users, Wrench, UserCircle,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import type { Profile } from '@/types/database';

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

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
    return u.full_name.toLowerCase().includes(q) || (u.phone || '').includes(q);
  });

  const handleBan = (user: Profile) => {
    const action = user.account_status === 'banned' ? 'فك الحظر' : 'حظر';
    Alert.alert(action, `هل تريد ${action} "${user.full_name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: async () => {
          const newStatus = user.account_status === 'banned' ? 'active' : 'banned';
          const { error } = await supabase
            .from('profiles')
            .update({ account_status: newStatus })
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
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
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
              if (!response.ok || result.error) {
                throw new Error(result.error || 'فشل حذف الحساب');
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

  const roleLabel = (role: string) => role === 'customer' ? 'زبون' : role === 'technician' ? 'فني' : 'أدمن';
  const roleColor = (role: string) => role === 'customer' ? colors.primary : role === 'technician' ? colors.success : colors.error;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الحسابات</Text>
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
            const isBanned = user.account_status === 'banned';
            const rColor = roleColor(user.role);
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
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopColor: '#e5e7eb', borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
});
