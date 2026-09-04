import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Alert, Image
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Award, Plus, Trash2, UploadCloud, FileText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast';

interface Certificate {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
}

export default function CertificatesScreen() {
  const { colors } = useTheme();
  const { show } = useToast();

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('technician_certificates')
        .select('*')
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (err: any) {
      show('فشل تحميل الشهادات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      show('يرجى كتابة عنوان أو اسم الشهادة', 'error');
      return;
    }
    if (!selectedImage) {
      show('يرجى اختيار صورة الشهادة', 'error');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مسجل');

      // رفع الصورة إلى Supabase Storage أو تخزينها مباشرة
      const fileExt = selectedImage.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `certificates/${fileName}`;

      // محاولة رفع الصورة
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      let publicUrl = selectedImage;
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(filePath);
        if (urlData?.publicUrl) publicUrl = urlData.publicUrl;
      }

      // إضافة السجل لجدول technician_certificates
      const { error: insertError } = await supabase
        .from('technician_certificates')
        .insert({
          technician_id: user.id,
          title: title.trim(),
          file_url: publicUrl,
        });

      if (insertError) throw insertError;

      show('تم إضافة الشهادة بنجاح', 'success');
      setModalVisible(false);
      setTitle('');
      setSelectedImage(null);
      loadCertificates();
    } catch (err: any) {
      show(err.message || 'حدث خطأ أثناء رفع الشهادة', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string, certTitle: string) => {
    Alert.alert('حذف شهادة', `هل أنت متأكد من حذف "${certTitle}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('technician_certificates').delete().eq('id', id);
            if (error) throw error;

            show('تم حذف الشهادة', 'success');
            loadCertificates();
          } catch (err: any) {
            show(err.message || 'فشل حذف الشهادة', 'error');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>شهادات الخبرة والمؤهلات</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Plus color={colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : certificates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Award color={colors.subtext} size={60} />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>لم تقم بإضافة أي شهادات بعد</Text>
            <TouchableOpacity
              style={[styles.addNewBtn, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Plus color="#fff" size={18} />
              <Text style={styles.addNewText}>إضافة شهادة جديدة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          certificates.map((cert) => (
            <View key={cert.id} style={[styles.certCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Image source={{ uri: cert.file_url }} style={styles.certImage} />
              <View style={styles.certInfo}>
                <View style={styles.certHeader}>
                  <FileText color={colors.primary} size={18} />
                  <Text style={[styles.certTitle, { color: colors.text }]} numberOfLines={1}>{cert.title}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(cert.id, cert.title)} style={styles.deleteBtn}>
                  <Trash2 color={colors.error} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal إضافة شهادة */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>إضافة شهادة جديدة</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>اسم أو عنوان الشهادة</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="مثال: شهادة صيانة التكييف المعتمدة"
                placeholderTextColor={colors.subtext}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border }]} onPress={pickImage}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              ) : (
                <View style={styles.pickerPlaceholder}>
                  <UploadCloud color={colors.primary} size={32} />
                  <Text style={[styles.pickerText, { color: colors.subtext }]}>اضغط لاختيار صورة الشهادة</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.text, fontFamily: 'Cairo-Bold' }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleUpload} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'Cairo-Bold' }}>رفع الشهادة</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  addBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  body: { padding: 16, gap: 12 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  addNewText: { color: '#fff', fontFamily: 'Cairo-Bold', fontSize: 14 },
  certCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  certImage: { width: '100%', height: 180, resizeMode: 'cover' },
  certInfo: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  certHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  certTitle: { fontFamily: 'Cairo-Bold', fontSize: 14, flex: 1, textAlign: 'right' },
  deleteBtn: { padding: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, gap: 16 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, textAlign: 'center' },
  inputGroup: { gap: 6 },
  label: { fontFamily: 'Cairo-Bold', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46, fontFamily: 'Cairo-Medium', textAlign: 'right' },
  imagePicker: { height: 140, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  pickerPlaceholder: { alignItems: 'center', gap: 6 },
  pickerText: { fontFamily: 'Cairo-Regular', fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
