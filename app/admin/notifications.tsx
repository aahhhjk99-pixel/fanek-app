import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Send, Bell } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';

export default function AdminNotificationsScreen() {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'customers' | 'technicians'>('all');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان الإشعار ونصل الرسالة');
      return;
    }

    setSending(true);
    try {
      // 1. حفظ الإشعار في قاعدة البيانات
      const { error: dbError } = await supabase
        .from('notifications')
        .insert({
          title: title.trim(),
          body: body.trim(),
          target_type: targetType,
        });

      if (dbError) throw dbError;

      // 2. جلب رموز الإشعارات (Push Tokens) للمستخدمين المستهدفين
      let query = supabase.from('profiles').select('push_token').not('push_token', 'is', null);

      if (targetType === 'customers') {
        query = query.eq('role', 'customer');
      } else if (targetType === 'technicians') {
        query = query.eq('role', 'technician');
      }

      const { data: users, error: usersError } = await query;

      if (!usersError && users && users.length > 0) {
        const tokens = users.map(u => u.push_token).filter(Boolean);

        // 3. إرسال الإشعار عبر سيرفر Expo لظهر على شاشة القفل
        if (tokens.length > 0) {
          const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: title.trim(),
            body: body.trim(),
            data: { targetType },
          }));

          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          });
        }
      }

      Alert.alert('نجاح', 'تم إرسال الإشعار وحفظه بنجاح!');
      setTitle('');
      setBody('');
      fetchHistory();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الإشعارات</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>الجمهور المستهدف</Text>
          <View style={styles.targetRow}>
            {[
              { id: 'all', label: 'الجميع' },
              { id: 'customers', label: 'الزبائن' },
              { id: 'technicians', label: 'الفنيين' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.targetBtn,
                  { borderColor: colors.border },
                  targetType === item.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setTargetType(item.id as any)}
              >
                <Text
                  style={[
                    styles.targetBtnText,
                    { color: colors.text },
                    targetType === item.id && { color: '#fff' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>عنوان الإشعار</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="أدخل عنوان الإشعار..."
            placeholderTextColor={colors.subtext}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.text }]}>نص الرسالة</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="اكتب نص الإشعار هنا..."
            placeholderTextColor={colors.subtext}
            multiline
            numberOfLines={4}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send color="#fff" size={18} />
                <Text style={styles.sendBtnText}>إرسال الإشعار الآن</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>سجل الإشعارات المرسلة</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 20, fontFamily: 'Cairo-Regular' }}>
            لا توجد إشعارات مرسلة سابقة
          </Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.historyHeader}>
                <Bell color={colors.primary} size={18} />
                <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
              </View>
              <Text style={[styles.historyBody, { color: colors.subtext }]}>{item.body}</Text>
              <Text style={[styles.historyMeta, { color: colors.subtext }]}>
                المستهدفين: {item.target_type === 'all' ? 'الجميع' : item.target_type === 'customers' ? 'الزبائن' : 'الفنيين'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  label: { fontFamily: 'Cairo-SemiBold', fontSize: 14, marginBottom: 8, marginTop: 10 },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  targetBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  targetBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: 'Cairo-Regular', fontSize: 14 },
  textArea: { height: 100, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10, marginTop: 20 },
  sendBtnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 15 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12 },
  historyCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyTitle: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  historyBody: { fontFamily: 'Cairo-Regular', fontSize: 13, marginBottom: 6 },
  historyMeta: { fontFamily: 'Cairo-Regular', fontSize: 11 },
});
