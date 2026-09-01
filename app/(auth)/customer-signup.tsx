import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Phone, MapPin, Check, Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CURRENCY, PROMO_CUSTOMER_DISCOUNT, TERMS_TEXT, BRAND_NAME, BRAND_LOGO } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';

export default function CustomerSignupScreen() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getLocation = () => {
    if (typeof navigator !== 'undefined' && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => setError('تعذر الحصول على الموقع. تأكد من تفعيل GPS'),
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
    if (!lat || !lng) { setError('الرجاء تحديد موقعك الجغرافي'); return; }
    if (!agreed) { setError('الرجاء الموافقة على الشروط والأحكام'); return; }

    setLoading(true);
    try {
      const email = `${phone}@services.ly`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError || !authData?.user) {
        throw new Error(authError?.message || 'فشل إنشاء الحساب');
      }

      const user = authData.user;
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'customer',
        location_lat: lat,
        location_lng: lng,
        location_address: address,
        verification_status: 'approved',
      });

      if (profileError) throw new Error(profileError.message);

      Alert.alert('تم', `تم إنشاء حسابك بنجاح! حصلت على خصم ${PROMO_CUSTOMER_DISCOUNT} ${CURRENCY} على أول صيانة.`);
      router.replace('/(tabs)');
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
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight color="#fff" size={24} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Star color="#fff" size={18} fill="#fff" />
          <Text style={styles.headerTitle}>{BRAND_NAME} {BRAND_LOGO}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>تسجيل زبون جديد</Text>
        <View style={[styles.promoCard, { backgroundColor: colors.promoBg, borderColor: colors.promoBorder }]}>
          <Text style={[styles.promoTitle, { color: colors.promoTitle }]}>عرض خاص!</Text>
          <Text style={[styles.promoDesc, { color: colors.promoText }]}>
            احصل على خصم {PROMO_CUSTOMER_DISCOUNT} {CURRENCY} على أول طلب صيانة
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

        <TouchableOpacity style={styles.termsRow} onPress={() => setShowTerms(true)}>
          <View style={[styles.checkbox, agreed && [styles.checkboxActive, { backgroundColor: colors.primary, borderColor: colors.primary }]]}>
            {agreed && <Check color="#fff" size={16} />}
          </View>
          <Text style={[styles.termsTextSmall, { color: colors.text }]}>
            أوافق على الشروط والأحكام
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.signupBtn, { backgroundColor: colors.primary }, loading && styles.signupBtnDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.signupBtnText}>
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {},
  termsTextSmall: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  errorText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  signupBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#fff',
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#2563eb',
  },
  termsTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
    color: '#fff',
  },
  termsBody: { padding: 24, paddingBottom: 40 },
  termsText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 15,
    lineHeight: 26,
  },
  agreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9ca3af',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
  },
  agreeBtnActive: { backgroundColor: '#16a34a' },
  agreeBtnText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: '#fff',
  },
});
