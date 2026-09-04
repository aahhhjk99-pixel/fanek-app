import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
  Platform, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Phone, MapPin, Check, Star, MessageCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CURRENCY, PROMO_TECHNICIAN_BONUS, COMMISSION_RATE, TERMS_TEXT, BRAND_NAME, BRAND_LOGO, SERVICE_CATEGORIES } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';

// رقم الواتساب الخاص بالإدارة المخصص لاستلام الصور والوثائق
const ADMIN_WHATSAPP = '218930656956';

export default function TechnicianSignupScreen() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getLocation = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => setError('تعذر الحصول على الموقع'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLat(32.8872);
      setLng(13.1913);
      setAddress('طرابلس، ليبيا');
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); return; }
    if (!phone.trim() || phone.trim().length < 8) { setError('الرجاء إدخال رقم هاتف صحيح'); return; }
    if (!password.trim() || password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!specialty) { setError('الرجاء اختيار التخصص'); return; }
    if (!lat || !lng) { setError('الرجاء تحديد موقعك الجغرافي'); return; }
    if (!agreed) { setError('الرجاء الموافقة على الشروط والأحكام'); return; }

    setLoading(true);
    try {
      const email = `${phone.trim()}@services.ly`;
      
      // 1. تسجيل المستخدم وإمرارية role في auth metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'technician',
            full_name: fullName.trim(),
          },
        },
      });

      if (authError || !authData?.user) {
        throw new Error(authError?.message || 'فشل إنشاء الحساب');
      }

      const user = authData.user;

      // 2. تحديث الملف الشخصي عبر upsert بدون رفع صور لتوفير Egress
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'technician',
        location_lat: lat,
        location_lng: lng,
        location_address: address,
        id_photo_url: null,
        work_photos: [],
        verification_status: 'pending',
        technician_status: 'offline',
        specialty,
      });

      if (profileError) throw new Error(profileError.message);

      // 3. إنشاء أو تحديث المحفظة
      const { error: walletError } = await supabase.from('wallets').upsert({
        technician_id: user.id,
        balance: PROMO_TECHNICIAN_BONUS,
      });

      if (walletError) throw new Error(walletError.message);

      // 4. تسجيل مكافأة التسجيل في السجل المالي
      const ledgerId = crypto.randomUUID();
      await supabase.from('financial_ledger').insert({
        transaction_id: ledgerId,
        wallet_id: null,
        technician_id: user.id,
        type: 'signup_bonus',
        amount: PROMO_TECHNICIAN_BONUS,
        balance_before: 0,
        balance_after: PROMO_TECHNICIAN_BONUS,
        description: `رصيد افتتاحي مجاني (${PROMO_TECHNICIAN_BONUS} ${CURRENCY})`,
      });

      // 5. التوجيه لصفحة تسجيل الدخول
      Alert.alert(
        'تم التسجيل',
        `تم إنشاء حسابك بنجاح! تم إضافة ${PROMO_TECHNICIAN_BONUS} ${CURRENCY} رصيد مجاني إلى محفظتك. يرجى إرسال أوراقك للواتساب للتوثيق.`,
        [
          {
            text: 'حسناً',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.termsHeader}>
          <TouchableOpacity onPress={() => setShowTerms(false)} style={styles.backBtn}>
            <ChevronRight color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.termsTitle}>الشروط والأحكام</Text>
        </View>
        <ScrollView contentContainerStyle={styles.termsBody}>
          <Text style={[styles.termsText, { color: colors.text }]}>{TERMS_TEXT}</Text>
          <TouchableOpacity
            style={[styles.agreeBtn, agreed && styles.agreeBtnActive]}
            onPress={() => { setAgreed(true); setShowTerms(false); }}
          >
            <Check color="#fff" size={20} />
            <Text style={styles.agreeBtnText}>موافق على الشروط</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={['#16a34a', '#15803d']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight color="#fff" size={24} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Star color="#fff" size={18} fill="#fff" />
          <Text style={styles.headerTitle}>{BRAND_NAME} {BRAND_LOGO}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>تسجيل فني جديد</Text>
        <View style={[styles.promoCard, { backgroundColor: colors.promoBg, borderColor: colors.promoBorder }]}>
          <Text style={[styles.promoTitle, { color: colors.promoTitle }]}>عرض الانطلاق للفنيين!</Text>
          <Text style={[styles.promoDesc, { color: colors.promoText }]}>
            {PROMO_TECHNICIAN_BONUS} {CURRENCY} رصيد مجاني عند التوثيق • عمولة المنصة {COMMISSION_RATE}%
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>الاسم الكامل</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.inputBorder }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="أدخل اسمك الكامل"
            placeholderTextColor={colors.subtext}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>رقم الهاتف</Text>
          <View style={[styles.phoneInput, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}>
            <Phone color={colors.subtext} size={20} style={{ marginLeft: 8 }} />
            <TextInput
              style={[styles.phoneField, { color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="091XXXXXXX"
              placeholderTextColor={colors.subtext}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>كلمة المرور</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.inputBorder }]}
            value={password}
            onChangeText={setPassword}
            placeholder="6 أحرف على الأقل"
            placeholderTextColor={colors.subtext}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>التخصص</Text>
          <View style={styles.categoriesGrid}>
            {SERVICE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.chipBg, borderColor: colors.border },
                  specialty === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSpecialty(cat.id)}
              >
                <Text style={[styles.categoryText, { color: colors.chipText }, specialty === cat.id && { color: colors.chipActiveText }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>الموقع الجغرافي</Text>
          <TouchableOpacity
            style={[styles.locationBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
            onPress={getLocation}
          >
            <MapPin color={lat ? colors.success : colors.primary} size={20} />
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {lat ? address : 'اضغط لتحديد موقعك'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* بطاقة توجيه للواتساب لإرسال المستندات والصور للإدارة */}
        <View style={[styles.whatsappCard, { backgroundColor: colors.cardBg, borderColor: '#22c55e' }]}>
          <View style={styles.whatsappHeader}>
            <MessageCircle color="#22c55e" size={22} />
            <Text style={[styles.whatsappTitle, { color: colors.text }]}>إرسال وثائق التوثيق والصور عبر الواتساب</Text>
          </View>
          <Text style={[styles.whatsappDesc, { color: colors.subtext }]}>
            لإتمام توثيق حسابك، يرجى إرسال صورة الهوية الوطنية وصور أعمالك السابقة مباشرة إلى إدارة التطبيق عبر الواتساب بعد إنشاء الحساب:
          </Text>
          <TouchableOpacity
            style={styles.whatsappBtn}
            onPress={() => {
              const formattedPhone = ADMIN_WHATSAPP.replace(/[^0-9]/g, '');
              const message = encodeURIComponent(`أهلاً إدارة ${BRAND_NAME}، أرغب في إرسال الوثائق والصور الخاصة بتسجيل حسابي كفني (الاسم: ${fullName || 'فني جديد'} - الهاتف: ${phone || 'غير مدخل'}).`);
              Linking.openURL(`https://wa.me/${formattedPhone}?text=${message}`);
            }}
          >
            <MessageCircle color="#fff" size={18} />
            <Text style={styles.whatsappBtnText}>إرسال الوثائق عبر الواتساب ({ADMIN_WHATSAPP})</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.termsRow} onPress={() => setShowTerms(true)}>
          <View style={[styles.checkbox, agreed && [styles.checkboxActive, { backgroundColor: colors.success, borderColor: colors.success }]]}>
            {agreed && <Check color="#fff" size={16} />}
          </View>
          <Text style={[styles.termsTextSmall, { color: colors.text }]}>
            أوافق على شروط العمل والعمولة ({COMMISSION_RATE}%)
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.signupBtn, { backgroundColor: colors.success }, loading && styles.signupBtnDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.signupBtnText}>
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب وانتظار المراجعة'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
    color: '#fff',
  },
  pageTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  body: { padding: 24, paddingBottom: 40 },
  promoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  promoTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  promoDesc: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontFamily: 'Cairo-Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    borderWidth: 1,
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  phoneField: {
    flex: 1,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    textAlign: 'left',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  categoryText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 13,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 10,
  },
  locationText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 15,
    flex: 1,
  },
  whatsappCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  whatsappTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
  },
  whatsappDesc: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  whatsappBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
    color: '#fff',
  },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: {},
  termsTextSmall: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  errorText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#ef4444', marginBottom: 16, textAlign: 'center' },
  signupBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
  termsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 50, backgroundColor: '#16a34a',
  },
  termsTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: '#fff' },
  termsBody: { padding: 24, paddingBottom: 40 },
  termsText: { fontFamily: 'Cairo-Regular', fontSize: 15, lineHeight: 26 },
  agreeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#9ca3af', borderRadius: 16, paddingVertical: 16, marginTop: 24,
  },
  agreeBtnActive: { backgroundColor: '#16a34a' },
  agreeBtnText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },
});
