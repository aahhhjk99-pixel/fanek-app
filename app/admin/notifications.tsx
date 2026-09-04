import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { Bell, Send, Users, UserCheck, Wrench, Clock, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  target_type: 'all' | 'customers' | 'technicians';
  created_at: string;
}

export default function AdminNotificationsScreen() {
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'customers' | 'technicians'>('all');
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // جلب سجل الإشعارات
  const fetchHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'فشل جلب سجل الإشعارات');
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // إرسال الإشعار
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان الإشعار ونص الرسالة');
      return;
    }

    setSending(true);
    try {
      // 1. حفظ الإشعار في القاعدة
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: title.trim(),
          body: body.trim(),
          target_type: targetType,
        });

      if (error) throw error;

      Alert.alert('نجاح', 'تم إرسال وحفظ الإشعار بنجاح!');
      setTitle('');
      setBody('');
      fetchHistory();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  // حذف إشعار من السجل
  const handleDelete = (id: string) => {
    Alert.alert('حذف الإشعار', 'هل أنت متأكد من حذف هذا الإشعار من السجل؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('notifications').delete().eq('id', id);
          fetchHistory();
        },
      },
    ]);
  };

  const getTargetBadge = (type: string) => {
    switch (type) {
      case 'customers':
        return { label: 'الزبائن فقط', color: '#0284c7', icon: UserCheck };
      case 'technicians':
        return { label: 'الفنيين فقط', color: '#d97706', icon: Wrench };
      default:
        return { label: 'الجميع', color: '#16a34a', icon: Users };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* الهيدر */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Bell color={colors.primary} size={22} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>إدارة الإشعارات الجماعية</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHistory} />}
      >
        {/* نموذج إنشاء إشعار */}
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>إرسال إشعار جديد</Text>

          {/* تحديد الوجهة */}
          <Text style={[styles.label, { color: colors.subtext }]}>إرسال إلى:</Text>
          <View style={styles.targetRow}>
            {[
              { id: 'all', label: 'الجميع', icon: Users },
              { id: 'customers', label: 'الزبائن', icon: UserCheck },
              { id: 'technicians', label: 'الفنيين', icon: Wrench },
            ].map((item) => {
              const IconComp = item.icon;
              const isSelected = targetType === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.targetChip,
                    { backgroundColor: isSelected ? colors.primary : colors.chipBg, borderColor: colors.border }
                  ]}
                  onPress={() => setTargetType(item.id as any)}
                >
                  <IconComp color={isSelected ? '#fff' : colors.subtext} size={16} />
                  <Text style={[styles.targetChipText, { color: isSelected ? '#fff' : colors.text }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* عنوان الإشعار */}
          <Text style={[styles.label, { color: colors.subtext }]}>عنوان الإشعار:</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            placeholder="مثال: خصم خاص اليوم!"
            placeholderTextColor={colors.subtext}
            value={title}
            onChangeText={setTitle}
          />

          {/* نص الإشعار */}
          <Text style={[styles.label, { color: colors.subtext }]}>نص الرسالة:</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            placeholder="اكتب تفاصيل الإشعار هنا..."
            placeholderTextColor={colors.subtext}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={body}
            onChangeText={setBody}
          />

          {/* زر الإرسال */}
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, sending && { opacity: 0.6 }]}
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

        {/* سجل الإشعارات السابق */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>سجل الإشعارات المرسلة</Text>

          {loadingHistory ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : history.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد إشعارات مرسلة سابقاً</Text>
          ) : (
            history.map((item) => {
              const badge = getTargetBadge(item.target_type);
              const BadgeIcon = badge.icon;
              return (
                <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.historyHeader}>
                    <View style={[styles.badge, { backgroundColor: badge.color + '15' }]}>
                      <BadgeIcon color={badge.color} size={12} />
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>

                    <TouchableOpacity onPress={() => handleDelete(item.id)}>
                      <Trash2 color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.historyTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.historyBody, { color: colors.subtext }]}>{item.body}</Text>

                  <View style={styles.timeRow}>
                    <Clock size={12} color={colors.subtext} />
                    <Text style={[styles.timeText, { color: colors.subtext }]}>
                      {new Date(item.created_at).toLocaleString('ar-LY')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16, gap: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  label: { fontFamily: 'Cairo-Medium', fontSize: 13, marginTop: 4 },
  targetRow: { flexDirection: 'row', gap: 8 },
  targetChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  targetChipText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'right' },
  textArea: { height: 90 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  sendBtnText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 15 },
  historySection: { gap: 10 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center', marginVertical: 20 },
  historyCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontFamily: 'Cairo-Bold', fontSize: 11 },
  historyTitle: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  historyBody: { fontFamily: 'Cairo-Regular', fontSize: 13 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timeText: { fontFamily: 'Cairo-Regular', fontSize: 11 },
});
