import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
} from 'react-native';
import { ChevronLeft, Phone, MessageCircle, Save, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AppSettings } from '@/types/database';

export default function AdminSupportConfigScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').maybeSingle();
    const s = data as AppSettings | null;
    setSettings(s);
    setPhone(s?.support_phone || '');
    setWhatsapp(s?.support_whatsapp || '');
    setVisible(s?.support_visible ?? true);
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    if (!phone.trim() || !whatsapp.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال جميع الأرقام');
      return;
    }
    setSaving(true);
    try {
      if (settings) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            support_phone: phone.trim(),
            support_whatsapp: whatsapp.trim(),
            support_visible: visible,
            updated_by: profile?.id,
          })
          .eq('id', settings.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            support_phone: phone.trim(),
            support_whatsapp: whatsapp.trim(),
            support_visible: visible,
            updated_by: profile?.id,
          });
        if (error) throw new Error(error.message);
      }
      Alert.alert('تم', 'تم حفظ إعدادات الدعم بنجاح');
      router.back();
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>إعدادات الدعم الفني</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : (
          <>
            <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Phone color={colors.primary} size={22} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>رقم هاتف الدعم</Text>
              </View>
              <Text style={[styles.fieldDesc, { color: colors.subtext }]}>
                هذا الرقم يظهر للزبائن والفنيين في صفحة الدعم للاتصال المباشر
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="مثال: 21891xxxxxxx"
                placeholderTextColor={colors.subtext}
                keyboardType="phone-pad"
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <MessageCircle color="#25D366" size={22} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>رقم واتساب الدعم</Text>
              </View>
              <Text style={[styles.fieldDesc, { color: colors.subtext }]}>
                هذا الرقم يظهر للزبائن والفنيين للتواصل عبر واتساب مباشرة
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="مثال: 21891xxxxxxx"
                placeholderTextColor={colors.subtext}
                keyboardType="phone-pad"
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                {visible ? <Eye color={colors.success} size={22} /> : <EyeOff color={colors.subtext} size={22} />}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>إظهار معلومات الدعم</Text>
              </View>
              <Text style={[styles.fieldDesc, { color: colors.subtext }]}>
                عند الإيقاف، لن تظهر أزرار الدعم للزبائن والفنيين في التطبيق
              </Text>
              <TouchableOpacity
                style={[styles.toggleRow, { backgroundColor: colors.inputBg }]}
                onPress={() => setVisible(!visible)}
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {visible ? 'الدعم ظاهر للمستخدمين' : 'الدعم مخفي عن المستخدمين'}
                </Text>
                <View style={[styles.toggleSwitch, { backgroundColor: visible ? colors.primary : colors.border }]}>
                  <View style={[styles.toggleDot, { alignSelf: visible ? 'flex-end' : 'flex-start', backgroundColor: colors.cardBg }]} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Save color="#fff" size={20} />
              <Text style={styles.saveBtnText}>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</Text>
            </TouchableOpacity>
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
  loadingText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 16 },
  fieldDesc: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Cairo-Regular', fontSize: 15, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, padding: 3, flexDirection: 'row' },
  toggleDot: { width: 22, height: 22, borderRadius: 11 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 16, marginTop: 8 },
  saveBtnText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
});
