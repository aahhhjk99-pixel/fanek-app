import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Image, Linking, Alert,
} from 'react-native';
import { Send, Phone, ChevronLeft, Camera, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, Order, Profile } from '@/types/database';

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [otherParty, setOtherParty] = useState<Profile | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadData = useCallback(async () => {
    if (!profile || !orderId) return;

    const { data: orderData } = await supabase.from('orders').select(`
      *, service:services(*), customer:profiles!orders_customer_id_fkey(*),
      technician:profiles!orders_technician_id_fkey(*)
    `).eq('id', orderId).maybeSingle();
    const orderResult = orderData as Order | null;
    setOrder(orderResult);

    const other = profile.role === 'customer' ? orderResult?.technician : orderResult?.customer;
    setOtherParty(other || null);

    const { data: msgs } = await supabase.from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(*)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setMessages((msgs as ChatMessage[]) || []);

    await supabase.from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('receiver_id', profile.id)
      .is('read_at', null);

    setLoading(false);
  }, [profile, orderId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(`chat-${orderId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.receiver_id === profile?.id) {
            supabase.from('chat_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .is('read_at', null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, profile?.id]);

  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !profile || !order || !otherParty) return;
    const text = input.trim();
    setInput('');
    await supabase.from('chat_messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      receiver_id: otherParty.id,
      body: text,
      image_url: '',
    });
  };

  const sendImage = async (imageUri: string) => {
    if (!profile || !order || !otherParty) return;
    await supabase.from('chat_messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      receiver_id: otherParty.id,
      body: '',
      image_url: imageUri,
    });
  };

  const pickAndSendImage = async () => {
    if (!profile || !otherParty) return;

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => sendImage(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('لا يوجد إذن', 'يجب السماح بالوصول إلى الصور لإرسالها');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    await sendImage(uri);
  };

  const handleCall = () => {
    if (!otherParty?.phone) {
      Alert.alert('لا يوجد رقم', 'رقم الهاتف غير متاح');
      return;
    }
    Linking.openURL(`tel:${otherParty.phone}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.subtext }}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {otherParty?.full_name || 'محادثة'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.subtext }]} numberOfLines={1}>
            {order?.service?.name || 'طلب'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleCall} style={[styles.callBtn, { backgroundColor: colors.primaryLight }]}>
          <Phone color={colors.primary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <MessageCircle color={colors.subtext} size={48} />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              لا توجد رسائل بعد. ابدأ المحادثة الآن!
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === profile?.id;
            return (
              <View key={msg.id} style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
                <View style={[
                  styles.bubble,
                  isMine ? [styles.bubbleMine, { backgroundColor: colors.primary }] : [styles.bubbleOther, { backgroundColor: colors.cardBg, borderColor: colors.border }],
                ]}>
                  {msg.image_url ? (
                    <Image source={{ uri: msg.image_url }} style={styles.messageImage} resizeMode="cover" />
                  ) : null}
                  {msg.body ? (
                    <Text style={[styles.messageText, { color: isMine ? '#fff' : colors.text }]}>
                      {msg.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.inputBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.inputBg }]} onPress={pickAndSendImage}>
          <Camera color={colors.subtext} size={22} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          value={input}
          onChangeText={setInput}
          placeholder="اكتب رسالة..."
          placeholderTextColor={colors.subtext}
          multiline
          maxLength={500}
        />
        <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: colors.primary }]} disabled={!input.trim()}>
          <Send color="#fff" size={20} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, alignItems: 'center' },
  headerName: { fontFamily: 'Cairo-Bold', fontSize: 16 },
  headerSub: { fontFamily: 'Cairo-Regular', fontSize: 12, marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  messagesContainer: { padding: 16, paddingBottom: 20 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, textAlign: 'center' },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  messageText: { fontFamily: 'Cairo-Regular', fontSize: 14, lineHeight: 20 },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  cameraBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontFamily: 'Cairo-Regular', fontSize: 14, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
