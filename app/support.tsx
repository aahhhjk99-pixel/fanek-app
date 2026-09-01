import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { ChevronLeft, MessageCircle, Phone, HelpCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { FAQ_ITEMS, TERMS_TEXT, WHATSAPP_NUMBER } from '@/lib/constants';
import type { AppSettings } from '@/types/database';

export default function SupportScreen() {
  const { colors } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [showTerms, setShowTerms] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').maybeSingle();
    setSettings(data as AppSettings | null);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const supportVisible = settings?.support_visible ?? true;
  const whatsappNumber = settings?.support_whatsapp || WHATSAPP_NUMBER;
  const phoneNumber = settings?.support_phone || WHATSAPP_NUMBER;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الدعم والمساعدة</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {supportVisible ? (
          <View style={styles.supportButtons}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber}`)}>
              <MessageCircle color="#fff" size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappTitle}>دعم فوري عبر واتساب</Text>
                <Text style={styles.whatsappDesc}>تواصل معنا مباشرة لحل أي مشكلة</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.phoneBtn, { backgroundColor: colors.primaryLight }]} onPress={() => Linking.openURL(`tel:${phoneNumber}`)}>
              <Phone color={colors.primary} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.phoneTitle, { color: colors.primary }]}>اتصال هاتفي</Text>
                <Text style={[styles.phoneDesc, { color: colors.subtext }]}>{phoneNumber}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.hiddenBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.hiddenText, { color: colors.subtext }]}>خدمة الدعم المباشر غير متاحة حالياً.</Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <HelpCircle color={colors.primary} size={22} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>الأسئلة الشائعة</Text>
          </View>
          {FAQ_ITEMS.map((item, i) => (
            <View key={i} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.faqHeader} onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{item.question}</Text>
                {expandedFaq === i ? <ChevronUp color={colors.subtext} size={20} /> : <ChevronDown color={colors.subtext} size={20} />}
              </TouchableOpacity>
              {expandedFaq === i && <Text style={[styles.faqAnswer, { color: colors.subtext }]}>{item.answer}</Text>}
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.termsToggle} onPress={() => setShowTerms(!showTerms)}>
            <FileText color={colors.subtext} size={22} />
            <Text style={[styles.termsText, { color: colors.text }]}>الشروط والأحكام</Text>
            {showTerms ? <ChevronUp color={colors.subtext} size={20} /> : <ChevronDown color={colors.subtext} size={20} />}
          </TouchableOpacity>
          {showTerms && (
            <ScrollView style={[styles.termsBox, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.termsContent, { color: colors.text }]}>{TERMS_TEXT}</Text>
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16, paddingBottom: 40 },
  supportButtons: { gap: 12, marginBottom: 24 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#25D366', borderRadius: 16, padding: 20 },
  whatsappTitle: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
  whatsappDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  phoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 20 },
  phoneTitle: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  phoneDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 2 },
  hiddenBox: { borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, alignItems: 'center' },
  hiddenText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center' },
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18 },
  faqItem: { borderBottomWidth: 1, paddingVertical: 12 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faqQuestion: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 14 },
  faqAnswer: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 22, marginTop: 8 },
  termsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termsText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 15 },
  termsBox: { marginTop: 12, borderRadius: 12, padding: 16, maxHeight: 300 },
  termsContent: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 22 },
});
