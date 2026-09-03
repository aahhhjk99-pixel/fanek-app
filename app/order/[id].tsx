import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, TextInput, Modal,
} from 'react-native';
import {
  ChevronLeft, MapPin, Phone, MessageCircle, CheckCircle, XCircle,
  Wrench, FileText, Navigation, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime, timeAgo, calculateDistance } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_FLOW, WARRANTY_TEXT, COMMISSION_RATE } from '@/lib/constants';
import type { Order, Invoice, Profile } from '@/types/database';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { show } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [technician, setTechnician] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [techLocation, setTechLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // حالات نافذة إلغاء الطلب
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('orders').select(`
      *, service:services(*), customer:profiles!orders_customer_id_fkey(*),
      technician:profiles!orders_technician_id_fkey(*)
    `).eq('id', id).maybeSingle();
    const orderData = data as Order | null;
    setOrder(orderData);
    setTechnician(orderData?.technician || null);

    if (orderData?.technician_id) {
      const { data: techData } = await supabase.from('profiles')
        .select('*').eq('id', orderData.technician_id).maybeSingle();
      const tech = techData as Profile | null;
      setTechnician(tech);
      if (tech?.location_lat && tech?.location_lng) {
        setTechLocation({ lat: tech.location_lat, lng: tech.location_lng });
      }
    }

    const { data: invData } = await supabase.from('invoices')
      .select('*').eq('order_id', id).maybeSingle();
    setInvoice(invData as Invoice | null);

    setLoading(false);
  }, [id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // Live location tracking for customer when order is active
  useEffect(() => {
    if (!order?.technician_id || profile?.role !== 'customer') return;
    const isActive = ['accepted', 'en_route', 'arrived', 'in_progress'].includes(order.status);
    if (!isActive) return;

    pollRef.current = setInterval(async () => {
      const { data } = await supabase.from('profiles')
        .select('location_lat, location_lng')
        .eq('id', order.technician_id).maybeSingle();
      if (data?.location_lat && data?.location_lng) {
        setTechLocation({ lat: data.location_lat, lng: data.location_lng });
      }
    }, 10000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [order?.technician_id, order?.status, profile?.role]);

  // Realtime subscription for order status changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => { loadOrder(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadOrder]);

  const updateStatus = async (status: any) => {
    if (!order) return;
    const updates: any = { status };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
    if (error) {
      show('فشل تحديث الحالة', 'error');
    } else {
      show('تم تحديث حالة الطلب', 'success');
      loadOrder();
    }
  };

  // دالة تأكيد إلغاء الطلب مع حفظ السبب والشخص الذي قام بالإلغاء
  const handleConfirmCancel = async () => {
    if (!order || !cancelReason.trim()) {
      show('الرجاء إدخال سبب الإلغاء', 'error');
      return;
    }
    setSubmittingCancel(true);
    try {
      const { error } = await supabase.from('orders').update({
        status: 'cancelled',
        cancellation_reason: cancelReason.trim(),
        cancelled_by: profile?.role || 'user',
      }).eq('id', order.id);

      if (error) throw error;

      show('تم إلغاء الطلب بنجاح', 'success');
      setShowCancelModal(false);
      setCancelReason('');
      loadOrder();
    } catch (err: any) {
      show(err.message || 'فشل إلغاء الطلب', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const issueInvoice = async () => {
    if (!order || !profile) return;
    const labor = parseFloat(laborCost) || 0;
    const parts = parseFloat(partsCost) || 0;
    if (labor <= 0 && parts <= 0) {
      show('أدخل التكلفة', 'error');
      return;
    }
    const total = labor + parts;
    const now = new Date();
    const isExempt = !!profile.commission_exempt &&
      (!profile.commission_exempt_until || new Date(profile.commission_exempt_until) > now);
    const rate = isExempt ? 0 : (profile.commission_rate ?? COMMISSION_RATE) / 100;
    const commission = total * rate;
    const { error } = await supabase.from('invoices').insert({
      order_id: order.id,
      technician_id: profile.id,
      customer_id: order.customer_id,
      labor_cost: labor,
      parts_cost: parts,
      total,
      commission_amount: commission,
      status: 'issued',
      locked: false,
    });
    if (error) {
      show('فشل إصدار الفاتورة', 'error');
    } else {
      await supabase.from('orders').update({ status: 'invoice_issued' }).eq('id', order.id);
      show('تم إصدار الفاتورة', 'success');
      setShowInvoiceForm(false);
      setLaborCost('');
      setPartsCost('');
      loadOrder();
    }
  };

  const confirmPayment = async () => {
    if (!invoice) return;
    const { error } = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice.id);
    if (error) {
      show('فشل تأكيد السداد', 'error');
    } else {
      await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', order!.id);
      show('تم تأكيد السداد', 'success');
      loadOrder();
    }
  };

  const submitDispute = async () => {
    if (!order || !profile || !disputeReason.trim()) return;
    setSubmittingDispute(true);
    const { error } = await supabase.from('disputes').insert({
      order_id: order.id,
      invoice_id: invoice?.id || '',
      customer_id: profile.id,
      technician_id: order.technician_id || '',
      reason: disputeReason.trim(),
      photos: [],
      status: 'open',
      admin_notes: '',
    });
    if (error) {
      show('فشل فتح النزاع', 'error');
    } else {
      await supabase.from('orders').update({ status: 'disputed' }).eq('id', order.id);
      await supabase.from('invoices').update({ locked: true, status: 'frozen' }).eq('id', invoice?.id);
      show('تم فتح النزاع', 'success');
      setShowDisputeModal(false);
      setDisputeReason('');
      loadOrder();
    }
    setSubmittingDispute(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.subtext }}>جاري التحميل...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.subtext }}>الطلب غير موجود</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCustomer = profile?.role === 'customer';
  const isTechnician = profile?.role === 'technician';
  const isAdmin = profile?.role === 'admin';
  const statusColor = ORDER_STATUS_COLORS[order.status];
  const dist = profile?.location_lat && techLocation
    ? calculateDistance(profile.location_lat, profile.location_lng!, techLocation.lat, techLocation.lng)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تفاصيل الطلب</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.statusCard, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{ORDER_STATUS_LABELS[order.status]}</Text>
          </View>
          <Text style={[styles.orderTime, { color: colors.subtext }]}>تم الإنشاء {timeAgo(order.created_at)}</Text>
          
          {/* إظهار سبب الإلغاء إذا كان الطلب ملغياً */}
          {order.status === 'cancelled' && (order as any).cancellation_reason && (
            <View style={styles.cancellationReasonBox}>
              <Text style={styles.cancellationReasonTitle}>سبب الإلغاء:</Text>
              <Text style={styles.cancellationReasonText}>{(order as any).cancellation_reason}</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <Wrench color={colors.primary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{order.service?.name || 'خدمة'}</Text>
          </View>
          {order.description ? (
            <Text style={[styles.description, { color: colors.subtext }]}>{order.description}</Text>
          ) : null}
          <View style={[styles.warrantyBadge, { backgroundColor: colors.success + '15' }]}>
            <ShieldCheck color={colors.success} size={16} />
            <Text style={[styles.warrantyText, { color: colors.success }]}>ضمان الفني لمدة 3 أيام على الصيانة</Text>
          </View>
        </View>

        {/* Live location tracking for customer */}
        {isCustomer && order.technician_id && ['accepted', 'en_route', 'arrived', 'in_progress'].includes(order.status) && (
          <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.primary }]}>
            <View style={styles.sectionRow}>
              <Navigation color={colors.primary} size={20} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>تتبع الفني المباشر</Text>
            </View>
            {techLocation ? (
              <View style={styles.locationInfo}>
                <MapPin color={colors.primary} size={16} />
                <Text style={[styles.locationText, { color: colors.text }]}>
                  {dist !== null ? `على بعد ${dist} كم من موقعك` : 'موقع الفني متاح'}
                </Text>
                <Text style={[styles.coordsText, { color: colors.subtext }]}>
                  إحداثيات: {techLocation.lat.toFixed(4)}, {techLocation.lng.toFixed(4)}
                </Text>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.liveText, { color: colors.success }]}>مباشر</Text>
              </View>
            ) : (
              <Text style={[styles.locationText, { color: colors.subtext }]}>في انتظار مشاركة الفني لموقعه...</Text>
            )}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <MapPin color={colors.subtext} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>موقع الطلب</Text>
          </View>
          <Text style={[styles.locationText, { color: colors.subtext }]}>
            {order.location_address || 'غير محدد'}
          </Text>
        </View>

        {/* People info */}
        <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.personRow}>
            <Text style={[styles.personLabel, { color: colors.subtext }]}>الزبون:</Text>
            <Text style={[styles.personValue, { color: colors.text }]}>{order.customer?.full_name || 'غير محدد'}</Text>
          </View>
          <View style={styles.personRow}>
            <Text style={[styles.personLabel, { color: colors.subtext }]}>الفني:</Text>
            <Text style={[styles.personValue, { color: colors.text }]}>{order.technician?.full_name || 'غير محدد بعد'}</Text>
          </View>
        </View>

        {/* Invoice */}
        {invoice && (
          <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.sectionRow}>
              <FileText color={colors.primary} size={20} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>الفاتورة</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={[styles.invoiceLabel, { color: colors.subtext }]}>أجرة العمل:</Text>
              <Text style={[styles.invoiceValue, { color: colors.text }]}>{formatCurrency(invoice.labor_cost)}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={[styles.invoiceLabel, { color: colors.subtext }]}>قطع الغيار:</Text>
              <Text style={[styles.invoiceValue, { color: colors.text }]}>{formatCurrency(invoice.parts_cost)}</Text>
            </View>
            <View style={[styles.invoiceTotalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.invoiceTotalLabel, { color: colors.text }]}>الإجمالي:</Text>
              <Text style={[styles.invoiceTotalValue, { color: colors.primary }]}>{formatCurrency(invoice.total)}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={[styles.invoiceLabel, { color: colors.subtext }]}>العمولة (10%):</Text>
              <Text style={[styles.invoiceValue, { color: colors.subtext }]}>{formatCurrency(invoice.commission_amount)}</Text>
            </View>
            <View style={[styles.invoiceStatusBadge, { backgroundColor: (invoice.status === 'paid' ? colors.success : invoice.status === 'frozen' ? colors.error : colors.warning) + '20' }]}>
              <Text style={[styles.invoiceStatusText, { color: invoice.status === 'paid' ? colors.success : invoice.status === 'frozen' ? colors.error : colors.warning }]}>
                {invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'frozen' ? 'مجمدة' : 'صادرة'}
              </Text>
            </View>
          </View>
        )}

        {/* Technician invoice form */}
        {isTechnician && order.status === 'work_done' && !invoice && (
          <View style={[styles.section, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>إصدار فاتورة</Text>
            {showInvoiceForm ? (
              <View>
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>أجرة العمل (د.ل)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                  value={laborCost}
                  onChangeText={setLaborCost}
                  placeholder="0"
                  keyboardType="numeric"
                />
                <Text style={[styles.inputLabel, { color: colors.subtext }]}>قطع الغيار (د.ل)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                  value={partsCost}
                  onChangeText={setPartsCost}
                  placeholder="0"
                  keyboardType="numeric"
                />
                <TouchableOpacity style={[styles.issueBtn, { backgroundColor: colors.primary }]} onPress={issueInvoice}>
                  <Text style={styles.issueBtnText}>إصدار الفاتورة</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.issueBtn, { backgroundColor: colors.primary }]} onPress={() => setShowInvoiceForm(true)}>
                <Text style={styles.issueBtnText}>تحديد التكلفة وإصدار الفاتورة</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          {order.technician_id && (
            <TouchableOpacity style={[styles.chatBtn, { backgroundColor: colors.primaryLight }]} onPress={() => router.push(`/chat/${order.id}`)}>
              <MessageCircle color={colors.primary} size={18} />
              <Text style={[styles.chatBtnText, { color: colors.primary }]}>محادثة</Text>
            </TouchableOpacity>
          )}
          {order.technician?.phone && (
            <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.success + '15' }]} onPress={() => Linking.openURL(`tel:${order.technician!.phone}`)}>
              <Phone color={colors.success} size={18} />
              <Text style={[styles.callBtnText, { color: colors.success }]}>اتصال</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Technician status flow buttons */}
        {isTechnician && order.technician_id === profile?.id && !['completed', 'cancelled', 'disputed'].includes(order.status) && (
          <View style={styles.statusActions}>
            {order.status === 'accepted' && (
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.primary }]} onPress={() => updateStatus('en_route')}>
                <Text style={styles.statusBtnText}>بدء التوجه</Text>
              </TouchableOpacity>
            )}
            {order.status === 'en_route' && (
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#06b6d4' }]} onPress={() => updateStatus('arrived')}>
                <Text style={styles.statusBtnText}>وصلت للموقع</Text>
              </TouchableOpacity>
            )}
            {order.status === 'arrived' && (
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#6366f1' }]} onPress={() => updateStatus('in_progress')}>
                <Text style={styles.statusBtnText}>بدء العمل</Text>
              </TouchableOpacity>
            )}
            {order.status === 'in_progress' && (
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.success }]} onPress={() => updateStatus('work_done')}>
                <Text style={styles.statusBtnText}>إنهاء العمل</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer payment confirmation */}
        {isCustomer && order.status === 'invoice_issued' && invoice && !invoice.locked && (
          <View style={styles.statusActions}>
            <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.success }]} onPress={confirmPayment}>
              <CheckCircle color="#fff" size={18} />
              <Text style={styles.statusBtnText}>تأكيد السداد</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.disputeBtn, { backgroundColor: colors.error + '15', borderColor: colors.error }]} onPress={() => setShowDisputeModal(true)}>
              <AlertTriangle color={colors.error} size={18} />
              <Text style={[styles.disputeBtnText, { color: colors.error }]}>اعتراض على الفاتورة</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel button - متاح الآن للزبون والفني والأدمن */}
        {!['completed', 'cancelled'].includes(order.status) && (isCustomer || isTechnician || isAdmin) && (
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.blockedBg, borderColor: colors.blockedBorder }]} onPress={() => setShowCancelModal(true)}>
            <XCircle color={colors.error} size={18} />
            <Text style={[styles.cancelBtnText, { color: colors.error }]}>إلغاء الطلب</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal الاعتراض على الفاتورة */}
      <Modal visible={showDisputeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>سبب الاعتراض</Text>
              <TouchableOpacity onPress={() => { setShowDisputeModal(false); setDisputeReason(''); }}>
                <Text style={[styles.modalClose, { color: colors.subtext }]}>إغلاق</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: colors.subtext }]}>اكتب سبب الاعتراض على الفاتورة</Text>
            <TextInput
              style={[styles.disputeInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="مثال: التكلفة أعلى من المتفق عليه..."
              placeholderTextColor={colors.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitDisputeBtn, { backgroundColor: colors.error }, (!disputeReason.trim() || submittingDispute) && { opacity: 0.6 }]}
              onPress={submitDispute}
              disabled={!disputeReason.trim() || submittingDispute}
            >
              <Text style={styles.submitDisputeBtnText}>{submittingDispute ? 'جاري الإرسال...' : 'إرسال الاعتراض'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal إلغاء الطلب الجديد والمطلوب */}
      <Modal visible={showCancelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>إلغاء الطلب</Text>
              <TouchableOpacity onPress={() => { setShowCancelModal(false); setCancelReason(''); }}>
                <Text style={[styles.modalClose, { color: colors.subtext }]}>إغلاق</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: colors.subtext }]}>الرجاء إدخال سبب الإلغاء (مطلوب)</Text>
            <TextInput
              style={[styles.disputeInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="اكتب سبب إلغاء هذا الطلب..."
              placeholderTextColor={colors.subtext}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitDisputeBtn, { backgroundColor: colors.error }, (!cancelReason.trim() || submittingCancel) && { opacity: 0.6 }]}
              onPress={handleConfirmCancel}
              disabled={!cancelReason.trim() || submittingCancel}
            >
              <Text style={styles.submitDisputeBtnText}>{submittingCancel ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}</Text>
            </TouchableOpacity>
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
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  body: { padding: 16, paddingBottom: 40 },
  statusCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  statusBadgeText: { fontFamily: 'Cairo-Bold', fontSize: 14, color: '#fff' },
  orderTime: { fontFamily: 'Cairo-Regular', fontSize: 12 },
  cancellationReasonBox: { marginTop: 8, padding: 10, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', width: '100%' },
  cancellationReasonTitle: { fontFamily: 'Cairo-Bold', fontSize: 13, color: '#ef4444' },
  cancellationReasonText: { fontFamily: 'Cairo-Regular', fontSize: 13, color: '#991b1b', marginTop: 2 },
  section: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Cairo-SemiBold', fontSize: 16 },
  description: { fontFamily: 'Cairo-Regular', fontSize: 14, lineHeight: 22 },
  locationInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  locationText: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  coordsText: { fontFamily: 'Cairo-Regular', fontSize: 11, width: '100%', marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: 'Cairo-Bold', fontSize: 11 },
  personRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  personLabel: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  personValue: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  invoiceLabel: { fontFamily: 'Cairo-Regular', fontSize: 14 },
  invoiceValue: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  invoiceTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: 1 },
  invoiceTotalLabel: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  invoiceTotalValue: { fontFamily: 'Cairo-Bold', fontSize: 18 },
  invoiceStatusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  invoiceStatusText: { fontFamily: 'Cairo-Bold', fontSize: 12 },
  inputLabel: { fontFamily: 'Cairo-Medium', fontSize: 13, marginBottom: 6, marginTop: 10 },
  textInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'Cairo-Regular', fontSize: 16, borderWidth: 1 },
  issueBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  issueBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
  actionsContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  chatBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  callBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  statusActions: { gap: 10, marginBottom: 12 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  statusBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
  disputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1 },
  disputeBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  warrantyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  warrantyText: { fontFamily: 'Cairo-Medium', fontSize: 13 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1, marginTop: 8 },
  cancelBtnText: { fontFamily: 'Cairo-Bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 20 },
  modalClose: { fontFamily: 'Cairo-Medium', fontSize: 14 },
  modalLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, marginBottom: 10 },
  disputeInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Cairo-Regular', fontSize: 15, borderWidth: 1, minHeight: 100, marginBottom: 16 },
  submitDisputeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitDisputeBtnText: { fontFamily: 'Cairo-Bold', fontSize: 15, color: '#fff' },
});
