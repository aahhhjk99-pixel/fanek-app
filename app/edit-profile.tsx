import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, User, Phone, MapPin, Lock, Save } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // حقول البيانات
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setAddress(profile.address || '');
      }
    } catch (err: any) {
      show('فشل تحميل بيانات الحساب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim() || !phone.trim()) {
      show('يرجى إدخال الاسم ورقم الهاتف', 'error');
      return;
    }

    setSaving(true);
    try {
      if (!userId) return;

      // 1. تحديث بيانات البروفايل (الاسم، الهاتف، العنوان)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 2. تحديث كلمة المرور إن تم إدخال كلمة جديدة
      if (newPassword.trim()) {
        if (newPassword.length < 6) {
          show('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
          setSaving(false);
          return;
        }

        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (authError) throw authError;
      }

      show('تم تحديث بيانات الحساب بنجاح', 'success');
      setNewPassword('');
      router.back();
    } catch (err: any) {
      show(err.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تعديل بيانات الحساب</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* الاسم الكامل */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>الاسم الكامل</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <User color={colors.subtext} size={20} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="أدخل اسمك الكامل"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        {/* رقم الهاتف */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>رقم الهاتف</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Phone color={colors.subtext} size={20} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="أدخل رقم الهاتف"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        {/* الموقع / العنوان */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>الموقع / العنوان</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <MapPin color={colors.subtext} size={20} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={address}
              onChangeText={setAddress}
              placeholder="المدينة / المنطقة"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        {/* كلمة المرور الجديدة */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>كلمة المرور الجديدة (اختياري)</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Lock color={colors.subtext} size={20} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="اتركها فارغة إذا لا تريد التغيير"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        {/* زر الحفظ */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save color="#fff" size={20} />
              <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 20, gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 50, gap: 10 },
  input: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 14, textAlign: 'right' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 12, gap: 8, marginTop: 12 },
  saveBtnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 16 },
});
