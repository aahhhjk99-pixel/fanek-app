import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { MessageCircle, ChevronDown, ChevronUp, FileText, HelpCircle, Star, Phone } from 'lucide-react-native';
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

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.termsToggle}
            onPress={() => setShowTerms(!showTerms)}
          >
            <FileText color={colors.subtext} size={22} />
            <Text style={[styles.termsToggleText, { color: colors.text }]}>الشروط والأحكام</Text>
            {showTerms ? (
              <ChevronUp color={colors.subtext} size={20} />
            ) : (
              <ChevronDown color={colors.subtext} size={20} />
            )}
          </TouchableOpacity>
          {showTerms && (
            <ScrollView style={[styles.termsBox, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.termsText, { color: colors.text }]}>{TERMS_TEXT}</Text>
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  brandText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  body: { padding: 16, paddingBottom: 40 },
  supportButtons: { gap: 12, marginBottom: 24 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#25D366', borderRadius: 16, padding: 20 },
  whatsappTitle: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
  whatsappDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  phoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 20 },
  phoneTitle: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  phoneDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 2 },
  hiddenSupportBox: { borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, alignItems: 'center' },
  hiddenSupportText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center' },
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18 },
  faqItem: { borderBottomWidth: 1, paddingVertical: 12 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faqQuestion: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 14 },
  faqAnswer: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 22, marginTop: 8 },
  termsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termsToggleText: { flex: 1, fontFamily: 'Cairo-Medium', fontSize: 15 },
  termsBox: { marginTop: 12, borderRadius: 12, padding: 16, maxHeight: 300 },
  termsText: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 22 },
});
