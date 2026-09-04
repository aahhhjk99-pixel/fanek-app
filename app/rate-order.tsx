import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Star, Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';

export default function RateOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { colors } = useTheme();
  const { show } = useToast();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderId) {
      show('رقم الطلب غير صالح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          rating,
          review_comment: comment.trim(),
        })
        .eq('id', orderId);

      if (error) throw error;

      show('شُكراً لك! تم إرسال تقييمك بنجاح', 'success');
      router.back();
    } catch (err: any) {
      show(err.message || 'فشل إرسال التقييم', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تقييم الخدمة</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>كيف كانت تجربتك مع الفني؟</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>ساعدنا في تحسين جودة الخدمات عبر تقييمك</Text>

        {/* النجوم */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Star
                size={36}
                color={star <= rating ? '#eab308' : colors.border}
                fill={star <= rating ? '#eab308' : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* كود التعليق */}
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="أكتب ملاحظاتك أو تعليقك هنا (اختياري)..."
          placeholderTextColor={colors.subtext}
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
        />

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Send color="#fff" size={18} />
              <Text style={styles.submitText}>إرسال التقييم</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 24, alignItems: 'center', gap: 16 },
  title: { fontFamily: 'Cairo-Bold', fontSize: 18, textAlign: 'center' },
  subtitle: { fontFamily: 'Cairo-Regular', fontSize: 13, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 14, textAlign: 'right', fontFamily: 'Cairo-Medium', height: 110, textAlignVertical: 'top' },
  submitBtn: { width: '100%', height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  submitText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 15 },
});
