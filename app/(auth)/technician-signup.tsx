import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
  Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Phone, MapPin, Check, Camera, FileText, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { CURRENCY, PROMO_TECHNICIAN_BONUS, COMMISSION_RATE, TERMS_TEXT, BRAND_NAME, BRAND_LOGO, SERVICE_CATEGORIES } from '@/lib/constants';
import { useTheme } from '@/lib/theme-context';

export default function TechnicianSignupScreen() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [idPhoto, setIdPhoto] = useState('');
  const [workPhotos, setWorkPhotos] = useState<string[]>([]);
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

  const pickImage = async (type: 'id' | 'work') => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (type === 'id') {
              setIdPhoto(result);
            } else {
              if (workPhotos.length < 3) {
                setWorkPhotos([...workPhotos, result]);
              }
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('يجب السماح بالوصول إلى الصور لإتمام التسجيل');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

    if (type === 'id') {
      setIdPhoto(uri);
    } else if (workPhotos.length < 3) {
      setWorkPhotos([...workPhotos, uri]);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); return; }
    if (!phone.trim() || phone.trim().length < 8) { setError('الرجاء إدخال رقم هاتف صحيح'); return; }
    if (!password.trim() || password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!specialty) { setError('الرجاء اختيار التخصص'); return; }
    if (!lat || !lng) { setError('الرجاء تحديد موقعك الجغرافي'); return; }
    if (!idPhoto) { setError('الرجاء رفع صورة الهوية الوطنية'); return; }
    if (workPhotos.length < 3) { setError('الرجاء رفع 3 صور لأعمال سابقة'); return; }
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

      // 2. تحديث الملف الشخصي عبر upsert لمنع خطأ التعارض مع Trigger
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'technician',
        location_lat: lat,
        location_lng: lng,
        location_address: address,
        id_photo_url: idPhoto,
        work_photos: workPhotos,
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

      // 5. التوجيه لصفحة تسجيل الدخول حتى لا يرفضه Auth Guard أثناء المراجعة
      Alert.alert(
        'تم التسجيل',
        `تم إنشاء حسابك بنجاح! تم إضافة ${PROMO_TECHNICIAN_BONUS} ${CURRENCY} رصيد مجاني إلى محفظتك. حسابك حالياً قيد المراجعة من الإدارة.`,
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

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>صورة الهوية الوطنية</Text>
          <TouchableOpacity
            style={[styles.uploadBox, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
            onPress={() => pickImage('id')}
          >
            {idPhoto ? (
              <Image source={{ uri: idPhoto }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <FileText color={colors.subtext} size={32} />
                <Text style={[styles.uploadText, { color: colors.subtext }]}>ارفع صورة الهوية</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>صور أعمال سابقة ({workPhotos.length}/3)</Text>
          <View style={styles.workPhotosRow}>
            {workPhotos.map((photo, i) => (
              <View key={i} style={[styles.workPhotoBox, { borderColor: colors.border }]}>
                <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="cover" />
              </View>
            ))}
            {workPhotos.length < 3 && (
              <TouchableOpacity
                style={[styles.uploadBoxSmall, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
                onPress={() => pickImage('work')}
              >
                <Camera color={colors.subtext} size={24} />
                <Text style={[styles.uploadTextSmall, { color: colors.subtext }]}>إضافة</Text>
              </TouchableOpacity>
            )}
          </View>
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
  uploadBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadPlaceholder: { alignItems: 'center', gap: 8 },
  uploadText: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  previewImage: { width: '100%', height: '100%' },
  workPhotosRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  workPhotoBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  uploadBoxSmall: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  uploadTextSmall: { fontFamily: 'Cairo-Regular', fontSize: 12 },
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
