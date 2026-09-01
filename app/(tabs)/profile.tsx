import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput,
} from 'react-native';
import {
  User, Phone, MapPin, LogOut, ChevronLeft, Shield, Wallet,
  FileText, Settings, Moon, Sun, Trash2,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import { BRAND_NAME, BRAND_LOGO } from '@/lib/constants';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile, deleteAccount } = useAuth();
  const { colors, mode, toggle } = useTheme();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [address, setAddress] = useState(profile?.location_address || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, location_address: address })
        .eq('id', profile!.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      setEditing(false);
      show('تم تحديث الملف بنجاح', 'success');
    } catch (err: any) {
      show(err.message || 'فشل التحديث', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟ سيتم مسح جميع البيانات المحلية.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          show('تم تسجيل الخروج', 'info');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب نهائياً',
      'هل أنت متأكد من حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح جميع بياناتك.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              show('تم حذف الحساب', 'info');
              router.replace('/(auth)/login');
            } catch (err: any) {
              show('فشل حذف الحساب', 'error');
            }
          },
        },
      ]
    );
  };

  if (!profile) return null;

  const roleLabel = profile.role === 'customer' ? 'زبون' : profile.role === 'technician' ? 'فني' : 'أدمن';
  const roleColor = profile.role === 'customer' ? colors.primary : profile.role === 'technician' ? colors.success : colors.error;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>حسابي</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {profile.full_name.charAt(0)}
            </Text>
          </View>
          {!editing ? (
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.text }]}>{profile.full_name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderBottomColor: colors.primary }]}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          )}
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Settings color={colors.subtext} size={20} />
            </TouchableOpacity>
          )}
        </View>

        {profile.role === 'technician' && (
          <View style={[styles.statusCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, {
                backgroundColor: profile.verification_status === 'approved' ? colors.success :
                  profile.verification_status === 'pending' ? colors.warning : colors.error
              }]} />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {profile.verification_status === 'approved' ? 'موثّق' :
                  profile.verification_status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.infoSection, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Phone color={colors.subtext} size={20} />
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>الهاتف</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{profile.phone || 'غير محدد'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <MapPin color={colors.subtext} size={20} />
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>الموقع</Text>
            {!editing ? (
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{profile.location_address || 'غير محدد'}</Text>
            ) : (
              <TextInput
                style={[styles.editInputSmall, { color: colors.text, borderBottomColor: colors.primary }]}
                value={address}
                onChangeText={setAddress}
                placeholder="العنوان"
                placeholderTextColor={colors.subtext}
              />
            )}
          </View>
          {profile.role === 'technician' && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Shield color={colors.subtext} size={20} />
              <Text style={[styles.infoLabel, { color: colors.subtext }]}>التخصص</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile.specialty || 'غير محدد'}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <User color={colors.subtext} size={20} />
            <Text style={[styles.infoLabel, { color: colors.subtext }]}>عضو منذ</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(profile.created_at)}</Text>
          </View>
        </View>

        {editing && (
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'جاري...' : 'حفظ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]} onPress={() => setEditing(false)}>
              <Text style={[styles.cancelBtnText, { color: colors.subtext }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={toggle}>
          {mode === 'light' ? <Moon color={colors.primary} size={22} /> : <Sun color={colors.accent} size={22} />}
          <Text style={[styles.menuText, { color: colors.text }]}>
            {mode === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          </Text>
          <View style={[styles.toggleIndicator, { backgroundColor: mode === 'dark' ? colors.primary : colors.inputBg }]}>
            <View style={[styles.toggleDot, { alignSelf: mode === 'dark' ? 'flex-end' : 'flex-start', backgroundColor: colors.cardBg }]} />
          </View>
        </TouchableOpacity>

        {profile.role === 'technician' && (
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/wallet' as any)}>
            <Wallet color={colors.primary} size={22} />
            <Text style={[styles.menuText, { color: colors.text }]}>المحفظة والسجل المالي</Text>
            <ChevronLeft color={colors.subtext} size={20} />
          </TouchableOpacity>
        )}

        {profile.role === 'admin' && (
          <>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin' as any)}>
              <Shield color={colors.error} size={22} />
              <Text style={[styles.menuText, { color: colors.text }]}>لوحة تحكم الأدمن</Text>
              <ChevronLeft color={colors.subtext} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin/users' as any)}>
              <User color={colors.primary} size={22} />
              <Text style={[styles.menuText, { color: colors.text }]}>إدارة الحسابات</Text>
              <ChevronLeft color={colors.subtext} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/admin/support-config' as any)}>
              <Phone color={colors.success} size={22} />
              <Text style={[styles.menuText, { color: colors.text }]}>إعدادات الدعم الفني</Text>
              <ChevronLeft color={colors.subtext} size={20} />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => router.push('/support' as any)}>
          <FileText color={colors.subtext} size={22} />
          <Text style={[styles.menuText, { color: colors.text }]}>الدعم والأسئلة الشائعة</Text>
          <ChevronLeft color={colors.subtext} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]} onPress={handleSignOut}>
          <LogOut color={colors.error} size={20} />
          <Text style={[styles.signOutText, { color: colors.error }]}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} onPress={handleDeleteAccount}>
          <Trash2 color="#ef4444" size={20} />
          <Text style={[styles.deleteText, { color: '#ef4444' }]}>حذف الحساب نهائياً</Text>
        </TouchableOpacity>

        <Text style={[styles.brandFooter, { color: colors.subtext }]}>{BRAND_NAME} {BRAND_LOGO}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 22 },
  body: { padding: 16, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'Cairo-Bold', fontSize: 26 },
  profileName: { fontFamily: 'Cairo-Bold', fontSize: 18, marginBottom: 6 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  roleText: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  editBtn: { padding: 8 },
  statusCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  infoSection: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontFamily: 'Cairo-Medium', fontSize: 14, width: 70 },
  infoValue: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'left' },
  editInput: { fontFamily: 'Cairo-Regular', fontSize: 16, borderBottomWidth: 1, paddingVertical: 4 },
  editInputSmall: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 14, borderBottomWidth: 1, paddingVertical: 4, textAlign: 'left' },
  editActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14, color: '#fff' },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  menuText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 15 },
  toggleIndicator: { width: 44, height: 24, borderRadius: 12, padding: 2, flexDirection: 'row' },
  toggleDot: { width: 20, height: 20, borderRadius: 10 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1 },
  signOutText: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1 },
  deleteText: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  brandFooter: { fontFamily: 'Cairo-Medium', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
