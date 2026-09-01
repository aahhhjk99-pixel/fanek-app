import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, TextInput,
  Modal, ActivityIndicator,
} from 'react-native';
import { Search, MapPin, Star, ChevronLeft, Sparkles, ShieldCheck, BrainCircuit, Loader2 } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { getServiceIcon } from '@/components/ServiceIcon';
import { calculateDistance } from '@/lib/format';
import { CURRENCY, SERVICE_CATEGORIES, PROMO_CUSTOMER_DISCOUNT, BRAND_NAME, BRAND_LOGO, WARRANTY_TEXT } from '@/lib/constants';
import type { Service, Profile } from '@/types/database';

type DiagnosisResult = {
  specialty: string;
  confidence: number;
  summary: string;
};

export default function CustomerHome() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topTechnicians, setTopTechnicians] = useState<Profile[]>([]);
  const [diagnosisModal, setDiagnosisModal] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);

  const loadData = useCallback(async () => {
    const { data: servicesData } = await supabase.from('services').select('*').order('category');
    setServices(servicesData as Service[] || []);

    const { data: techs } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'technician')
      .eq('verification_status', 'approved')
      .eq('technician_status', 'available')
      .limit(10);
    setTopTechnicians(techs as Profile[] || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredServices = services.filter((s) => {
    const matchesSearch = !search || s.name.includes(search) || s.description.includes(search);
    const matchesCategory = !selectedCategory || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOrderService = (service: Service) => {
    router.push({ pathname: '/order/[id]', params: { id: 'new', serviceId: service.id } } as any);
  };

  const runDiagnosis = async () => {
    if (!diagnosisText.trim()) return;
    setDiagnosing(true);
    setDiagnosisResult(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/gemini-diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ description: diagnosisText.trim() }),
      });
      if (!response.ok) {
        throw new Error(`فشل التشخيص (${response.status})`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setDiagnosisResult(data as DiagnosisResult);
    } catch (err: any) {
      setDiagnosisResult({ specialty: 'أجهزة', confidence: 0, summary: err.message || 'فشل التشخيص' });
    } finally {
      setDiagnosing(false);
    }
  };

  const createOrderFromDiagnosis = async () => {
    if (!diagnosisResult || !profile) return;
    try {
      const { data: service } = await supabase
        .from('services')
        .select('id')
        .eq('category', diagnosisResult.specialty)
        .limit(1)
        .maybeSingle();

      const serviceId = (service as any)?.id;
      if (!serviceId) {
        const { data: fallback } = await supabase
          .from('services')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (!fallback) return;
      }

      const { data: order } = await supabase.from('orders').insert({
        customer_id: profile.id,
        service_id: serviceId || (fallback as any).id,
        status: 'new',
        location_lat: profile.location_lat,
        location_lng: profile.location_lng,
        location_address: profile.location_address || '',
        description: `${diagnosisResult.summary} (تشخيص آلي: ${diagnosisResult.specialty})`,
      }).select('id').single();

      if (order) {
        setDiagnosisModal(false);
        setDiagnosisText('');
        setDiagnosisResult(null);
        router.push(`/order/${order.id}` as any);
      }
    } catch {
      setDiagnosisModal(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.subtext }]}>مرحباً،</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || 'زبون'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.brandBadge, { backgroundColor: colors.primaryLight }]}>
              <Star color={colors.primary} size={14} fill={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>{BRAND_NAME} {BRAND_LOGO}</Text>
            </View>
            <ThemeToggle compact />
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
          <Search color={colors.subtext} size={20} style={{ marginHorizontal: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ابحث عن خدمة..."
            placeholderTextColor={colors.subtext}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        {!profile?.promo_discount_used && (
          <View style={[styles.promoBanner, { backgroundColor: colors.promoBg, borderColor: colors.promoBorder }]}>
            <Sparkles color={colors.accent} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.promoTitle, { color: colors.promoTitle }]}>خصم أول طلب</Text>
              <Text style={[styles.promoDesc, { color: colors.promoText }]}>
                احصل على خصم {PROMO_CUSTOMER_DISCOUNT} {CURRENCY} على أول صيانة
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.aiDiagnosisBtn, { backgroundColor: colors.primary }]}
          onPress={() => setDiagnosisModal(true)}
          activeOpacity={0.85}
        >
          <BrainCircuit color="#fff" size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiDiagnosisTitle}>تشخيص العطل بالذكاء الاصطناعي</Text>
            <Text style={styles.aiDiagnosisDesc}>صوّر العطل أو اصفه وسيحدد التطبيق التخصص المطلوب</Text>
          </View>
          <ChevronLeft color="#fff" size={20} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>الأقسام</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, { backgroundColor: colors.chipBg, borderColor: colors.border }, !selectedCategory && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, { color: colors.chipText }, !selectedCategory && { color: colors.chipActiveText }]}>الكل</Text>
          </TouchableOpacity>
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = getServiceIcon(cat.icon);
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, { backgroundColor: colors.chipBg, borderColor: colors.border }, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Icon color={active ? '#fff' : cat.color} size={16} />
                <Text style={[styles.categoryText, { color: colors.chipText }, active && { color: colors.chipActiveText }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>الخدمات المتاحة</Text>
        {loading ? (
          <Text style={[styles.loadingText, { color: colors.subtext }]}>جاري التحميل...</Text>
        ) : filteredServices.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>لا توجد خدمات</Text>
        ) : (
          <View style={styles.servicesGrid}>
            {filteredServices.map((service) => {
              const Icon = getServiceIcon(service.icon);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  onPress={() => handleOrderService(service)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.serviceIconBox, { backgroundColor: colors.iconBg }]}>
                    <Icon color={colors.primary} size={24} />
                  </View>
                  <Text style={[styles.serviceName, { color: colors.text }]} numberOfLines={2}>{service.name}</Text>
                  <Text style={[styles.servicePrice, { color: colors.subtext }]}>
                    يُحدد بعد معاينة الفني
                  </Text>
                  <View style={[styles.warrantyBadge, { backgroundColor: colors.success + '15' }]}>
                    <ShieldCheck color={colors.success} size={14} />
                    <Text style={[styles.warrantyText, { color: colors.success }]}>ضمان 3 أيام</Text>
                  </View>
                  <View style={[styles.orderBtn, { backgroundColor: colors.iconBg }]}>
                    <Text style={[styles.orderBtnText, { color: colors.primary }]}>اطلب الآن</Text>
                    <ChevronLeft color={colors.primary} size={16} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {topTechnicians.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>فنيون متاحون</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {topTechnicians.map((tech) => {
                const dist = profile?.location_lat && tech.location_lat
                  ? calculateDistance(profile.location_lat, profile.location_lng!, tech.location_lat, tech.location_lng!)
                  : null;
                return (
                  <View key={tech.id} style={[styles.techCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={[styles.techAvatar, { backgroundColor: colors.iconBg }]}>
                      <Text style={[styles.techInitial, { color: colors.primary }]}>{tech.full_name.charAt(0)}</Text>
                    </View>
                    <Text style={[styles.techName, { color: colors.text }]} numberOfLines={1}>{tech.full_name}</Text>
                    <Text style={[styles.techSpecialty, { color: colors.subtext }]}>{tech.specialty}</Text>
                    <View style={styles.techInfo}>
                      <Star color={colors.accent} size={14} />
                      <Text style={[styles.techRating, { color: colors.accent }]}>جديد</Text>
                    </View>
                    {dist && <Text style={[styles.techDist, { color: colors.subtext }]}>{dist} كم</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* AI Diagnosis Modal */}
      <Modal visible={diagnosisModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>تشخيص العطل</Text>
              <TouchableOpacity onPress={() => { setDiagnosisModal(false); setDiagnosisResult(null); }}>
                <Text style={[styles.modalClose, { color: colors.subtext }]}>إغلاق</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.text }]}>اكتب وصف العطل</Text>
            <TextInput
              style={[styles.diagnosisInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              value={diagnosisText}
              onChangeText={setDiagnosisText}
              placeholder="مثال: المكيف لا يبرد والهواء الخارج منه دافئ..."
              placeholderTextColor={colors.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.diagnoseBtn, { backgroundColor: colors.primary }, diagnosing && styles.submitBtnDisabled]}
              onPress={runDiagnosis}
              disabled={diagnosing || !diagnosisText.trim()}
            >
              {diagnosing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <BrainCircuit color="#fff" size={18} />
                  <Text style={styles.diagnoseBtnText}>تشخيص الآن</Text>
                </>
              )}
            </TouchableOpacity>

            {diagnosisResult && (
              <View style={[styles.resultBox, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}>
                <View style={styles.resultHeader}>
                  <ShieldCheck color={colors.success} size={18} />
                  <Text style={[styles.resultSpecialty, { color: colors.text }]}>{diagnosisResult.specialty}</Text>
                  {diagnosisResult.confidence > 0 && (
                    <Text style={[styles.resultConfidence, { color: colors.subtext }]}>
                      دقة {Math.round(diagnosisResult.confidence * 100)}%
                    </Text>
                  )}
                </View>
                <Text style={[styles.resultSummary, { color: colors.subtext }]}>{diagnosisResult.summary}</Text>
                <TouchableOpacity
                  style={[styles.createOrderBtn, { backgroundColor: colors.success }]}
                  onPress={createOrderFromDiagnosis}
                  activeOpacity={0.85}
                >
                  <Text style={styles.createOrderBtnText}>إنشاء الطلب وتوجيه لأقرب فني</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  brandText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  greeting: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  userName: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 15, paddingVertical: 4 },
  scrollView: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  promoBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1 },
  promoTitle: { fontFamily: 'Cairo-Bold', fontSize: 15 },
  promoDesc: { fontFamily: 'Cairo-Regular', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 18, marginBottom: 12 },
  categoriesScroll: { marginBottom: 16, marginHorizontal: -16 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, marginRight: 8 },
  categoryText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  serviceCard: { width: '48%', flexGrow: 1, borderRadius: 20, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  serviceIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  serviceName: { fontFamily: 'Cairo-SemiBold', fontSize: 14, marginBottom: 4, lineHeight: 20 },
  servicePrice: { fontFamily: 'Cairo-Regular', fontSize: 12, marginBottom: 10 },
  warrantyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 10, alignSelf: 'flex-start' },
  warrantyText: { fontFamily: 'Cairo-Medium', fontSize: 11 },
  orderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  orderBtnText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  loadingText: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  techCard: { width: 140, borderRadius: 20, padding: 14, marginRight: 12, alignItems: 'center', borderWidth: 1 },
  techAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  techInitial: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  techName: { fontFamily: 'Cairo-SemiBold', fontSize: 13, marginBottom: 2 },
  techSpecialty: { fontFamily: 'Cairo-Regular', fontSize: 11, marginBottom: 6 },
  techInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  techRating: { fontFamily: 'Cairo-Medium', fontSize: 12 },
  techDist: { fontFamily: 'Cairo-Regular', fontSize: 11, marginTop: 4 },
  aiDiagnosisBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 24 },
  aiDiagnosisTitle: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
  aiDiagnosisDesc: { fontFamily: 'Cairo-Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  modalClose: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  modalLabel: { fontFamily: 'Cairo-Medium', fontSize: 14, marginBottom: 10 },
  diagnosisInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Cairo-Regular', fontSize: 15, borderWidth: 1, minHeight: 100, marginBottom: 16 },
  diagnoseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  submitBtnDisabled: { opacity: 0.6 },
  diagnoseBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
  resultBox: { borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  resultSpecialty: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 15 },
  resultConfidence: { fontFamily: 'Cairo-Regular', fontSize: 12 },
  resultSummary: { fontFamily: 'Cairo-Regular', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  createOrderBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createOrderBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14, color: '#fff' },
});
