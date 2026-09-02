import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, TextInput, ActivityIndicator } from 'react-native';
import { MessageCircle, ChevronDown, ChevronUp, FileText, HelpCircle, Star, Phone, Sparkles } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { FAQ_ITEMS, TERMS_TEXT, WHATSAPP_NUMBER, BRAND_NAME, BRAND_LOGO } from '@/lib/constants';
import type { AppSettings } from '@/types/database';

export default function SupportTabScreen() {
  const { colors } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [showTerms, setShowTerms] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // حالات الذكاء الاصطناعي
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ specialty?: string; summary?: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').maybeSingle();
    setSettings(data as AppSettings | null);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const supportVisible = settings?.support_visible ?? true;
  const whatsappNumber = settings?.support_whatsapp || WHATSAPP_NUMBER;
  const phoneNumber = settings?.support_phone || WHATSAPP_NUMBER;

  const openWhatsApp = () => {
    Linking.openURL(`https://wa.me/${whatsappNumber}`);
  };

  const openPhone = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // دالة تشخيص العطل عبر الذكاء الاصطناعي
  const handleDiagnose = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-diagnose', {
        body: { description: aiDescription },
      });

      if (error) throw new Error(error.message || 'تعذر الاتصال بالذكاء الاصطناعي');
      if (data?.error) throw new Error(data.error);

      setAiResult(data);
    } catch (err: any) {
      setAiError(err.message || 'حدث خطأ أثناء التشخيص');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>الدعم والمساعدة</Text>
            <View style={styles.brandRow}>
              <Star color={colors.primary} size={12} fill={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>{BRAND_NAME} {BRAND_LOGO}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* قسم التشخيص بالذكاء الاصطناعي */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Sparkles color={colors.primary} size={22} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>تشخيص العطل بالذكاء الاصطناعي</Text>
          </View>
          <Text style={[styles.aiSubtitle, { color: colors.subtext }]}>
            صف المشكلة وسيحدد لك الذكاء الاصطناعي التخصص المناسب فوراً:
          </Text>

          <TextInput
            style={[styles.aiInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
            placeholder="مثال: عندي تسريب مياه تحت حوض المطبخ..."
            placeholderTextColor={colors.subtext}
            value={aiDescription}
            onChangeText={setAiDescription}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.aiBtn, { backgroundColor: colors.primary, opacity: aiLoading || !aiDescription.trim() ? 0.7 : 1 }]}
            onPress={handleDiagnose}
            disabled={aiLoading || !aiDescription.trim()}
          >
            {aiLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.aiBtnText}>تشخيص العطل الآن</Text>
            )}
          </TouchableOpacity>

          {aiError ? <Text style={styles.errorText}>{aiError}</Text> : null}

          {aiResult && (
            <View style={[styles.resultBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Text style={[styles.resultSpecialty, { color: colors.primary }]}>
                التخصص المقترح: {aiResult.specialty}
              </Text>
              <Text style={[styles.resultSummary, { color: colors.text }]}>
                {aiResult.summary}
              </Text>
            </View>
          )}
        </View>

        {/* أزرار الاتصال والدعم */}
        {supportVisible ? (
          <View style={styles.supportButtons}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
              <MessageCircle color="#fff" size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappTitle}>دعم فوري عبر واتساب</Text>
                <Text style={styles.whatsappDesc}>تواصل معنا مباشرة لحل أي مشكلة</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.phoneBtn, { backgroundColor: colors.primaryLight }]} onPress={openPhone}>
              <Phone color={colors.primary} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.phoneTitle, { color: colors.primary }]}>اتصال هاتفي</Text>
                <Text style={[styles.phoneDesc, { color: colors.subtext }]}>{phoneNumber}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.hiddenSupportBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.hiddenSupportText, { color: colors.subtext }]}>
              خدمة الدعم المباشر غير متاحة حالياً. يرجى المحاولة لاحقاً.
            </Text>
          </View>
        )}

        {/* الأسئلة الشائعة */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <HelpCircle color={colors.primary} size={22} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>الأسئلة الشائعة</Text>
          </View>
          {FAQ_ITEMS.map((item, i) => (
            <View key={i} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{item.question}</Text>
                {expandedFaq === i ? (
                  <ChevronUp color={colors.subtext} size={20} />
                ) : (
                  <ChevronDown color={colors.subtext} size={20} />
                )}
              </TouchableOpacity>
              {expandedFaq === i && (
                <Text style={[styles.faqAnswer, { color: colors.subtext }]}>{item.answer}</Text>
              )}
            </View>
          ))}
        </View>

        {/* الشروط والأحكام */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.termsToggle}
            onPress={() => setShowTerms(!showTerms)}
          >
            <View style={styles.sectionHeader}>
              <FileText color={colors.primary} size={22} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>الشروط والأحكام</Text>
            </View>
            {showTerms ? (
              <ChevronUp color={colors.subtext} size={20} />
            ) : (
              <ChevronDown color={colors.subtext} size={20} />
            )}
          </TouchableOpacity>
          {showTerms && (
            <Text style={[styles.termsText, { color: colors.subtext }]}>{TERMS_TEXT}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  brandText: { fontSize: 12, fontWeight: '600' },
  body: { padding: 16, gap: 16 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  aiSubtitle: { fontSize: 13, marginTop: 6, marginBottom: 10 },
  aiInput: { borderWidth: 1, borderRadius: 8, padding: 10, textAlignVertical: 'top', minHeight: 70 },
  aiBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold' },
  errorText: { color: '#e74c3c', marginTop: 8, fontSize: 13, textAlign: 'center' },
  resultBox: { marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  resultSpecialty: { fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  resultSummary: { fontSize: 13 },
  supportButtons: { gap: 10 },
  whatsappBtn: { backgroundColor: '#25D366', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  whatsappTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  whatsappDesc: { color: '#e8f8ef', fontSize: 12 },
  phoneBtn: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  phoneTitle: { fontSize: 16, fontWeight: 'bold' },
  phoneDesc: { fontSize: 12 },
  hiddenSupportBox: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  hiddenSupportText: { fontSize: 13, textAlign: 'center' },
  faqItem: { borderBottomWidth: 1, paddingVertical: 12 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: 14, fontWeight: '600', flex: 1 },
  faqAnswer: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  termsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  termsText: { fontSize: 12, marginTop: 12, lineHeight: 18 },
});
