import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  DeviceEventEmitter,
  TouchableOpacity
} from 'react-native';
import { supabase } from '@/lib/supabase';

const SW = Dimensions.get('window').width;

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldBorder: 'rgba(212,175,55,0.28)',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  success: '#57D08B',
  divider: 'rgba(255,255,255,0.05)',
};

type MsgType = 'system' | 'game' | 'social' | 'promo' | 'announcement' | 'support';

interface Message {
  id: string;
  type: MsgType;
  title: string;
  content: string;
  time: string;
  read: boolean;
  sender?: string;
  userId?: string | null;
}

const CATEGORIES: { label: string; type: MsgType | 'all' }[] = [
  { label: 'All', type: 'all' },
  { label: 'Announcements', type: 'announcement' },
  { label: 'Games', type: 'game' },
  { label: 'Social', type: 'social' },
  { label: 'System', type: 'system' },
];

function MessageRow({ msg, active, onPress, delay }: { msg: Message; active: boolean; onPress: () => void; delay: number }) {
  const slideX = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 450, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const icons: Record<MsgType, any> = {
    system: { name: 'cog-outline', color: '#888' },
    game: { name: 'dice-multiple-outline', color: C.gold },
    social: { name: 'account-group-outline', color: '#5AAFF0' },
    promo: { name: 'ticket-outline', color: C.success },
    announcement: { name: 'megaphone-outline', color: '#5B8FF9' },
    support: { name: 'headset', color: '#57D08B' },
  };

  const icon = icons[msg.type];

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }], opacity }}>
      <TouchableOpacity 
        style={[s.msgCard, active && s.msgCardActive]} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={s.msgIconWrap}>
          <MaterialCommunityIcons name={icon.name} size={18} color={active ? C.textPrimary : icon.color} />
          {!msg.read && <View style={s.unreadPulse} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.msgTitle, !msg.read && s.msgTitleUnread, active && { color: C.textPrimary }]} numberOfLines={1}>
              {msg.title}
            </Text>
            <Text style={s.msgTimeSmall}>{msg.time}</Text>
          </View>
          <Text style={[s.msgPreviewText, active && { color: 'rgba(245,239,216,0.7)' }]} numberOfLines={1}>
            {msg.content}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function InboxPanel({ visible, onClose, initialTab }: { visible: boolean; onClose: () => void; initialTab?: MsgType | 'all' }) {
  const [filter, setFilter] = useState<MsgType | 'all'>(initialTab || 'all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SW * 0.1)).current;

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if first time user (no messages yet)
      const { count } = await supabase.from('inbox').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      
      if (count === 0) {
        // Send welcome message
        await supabase.from('inbox').insert({
          user_id: user.id,
          type: 'system',
          title: 'Welcome to Ludo Fusion!',
          content: 'We are excited to have you join our amazing community! As a first-time player, you have received a starter pack of coins. Use them to enter matches and climb the leaderboard. Good luck!',
          sender: 'Ludo Admin',
          is_read: false
        });
      }

      // Fetch private and global messages
      const { data, error } = await supabase
        .from('inbox')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch read announcements for this user
      const { data: readAnnouncements } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);
      
      const readSet = new Set((readAnnouncements || []).map(r => r.announcement_id));

      const formatted: Message[] = (data || []).map(m => ({
        id: m.id,
        type: m.type as MsgType,
        title: m.title,
        content: m.content,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: m.user_id === null ? readSet.has(m.id) : m.is_read,
        sender: m.sender,
        userId: m.user_id
      }));

      setMessages(formatted);
      if (formatted.length > 0 && !selectedId) {
        setSelectedId(formatted[0].id);
      }
    } catch (err) {
      console.error('Error loading inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const sub = DeviceEventEmitter.addListener('refresh_inbox', loadMessages);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setFilter(initialTab);
    }
  }, [initialTab]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 300, useNativeDriver: true }),
    ]).start(onClose);
  };

  const filtered = messages.filter(m => filter === 'all' || m.type === filter);
  const selectedMsg = messages.find(m => m.id === selectedId) || messages[0];

  const handleMarkAsRead = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg || msg.read) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (msg.type === 'announcement') {
      await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: user.id });
    } else {
      await supabase.from('inbox').update({ is_read: true }).eq('id', id);
    }

    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    DeviceEventEmitter.emit('wallet_updated');
  };

  const handleDelete = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (msg.userId) {
      // Private message — delete the row
      await supabase.from('inbox').delete().eq('id', id);
    } else {
      // Global announcement — mark as dismissed via announcement_reads
      await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: user.id });
    }

    // Remove from list
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) {
      const remaining = messages.filter(m => m.id !== id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
    DeviceEventEmitter.emit('wallet_updated');
  };

  const handleToggleRead = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newRead = !msg.read;

    if (msg.type === 'announcement') {
      if (newRead) {
        await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: user.id });
      } else {
        await supabase.from('announcement_reads').delete().eq('announcement_id', id).eq('user_id', user.id);
      }
    } else {
      await supabase.from('inbox').update({ is_read: newRead }).eq('id', id);
    }

    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: newRead } : m));
    DeviceEventEmitter.emit('wallet_updated');
  };

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Top Header */}
      <View style={s.topBar}>
        <View>
          <Text style={s.eyebrow}>COMMUNICATIONS</Text>
          <Text style={s.title}>Inbox</Text>
        </View>
        <View style={s.catWrap}>
          {CATEGORIES.map(cat => (
            <Pressable 
              key={cat.label} 
              onPress={() => setFilter(cat.type)}
              style={[s.catBtn, filter === cat.type && s.catBtnActive]}
            >
              <Text style={[s.catText, filter === cat.type && s.catTextActive]} numberOfLines={1}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
          <MaterialCommunityIcons name="close" size={20} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={s.mainGrid}>
        {/* Left: List */}
        <View style={s.listPanel}>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.gold} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <MaterialCommunityIcons name="email-outline" size={40} color={C.textMuted} />
              <Text style={{ color: C.textMuted, marginTop: 10 }}>No messages here</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 10 }}>
              {filtered.map((msg, i) => (
                <MessageRow 
                  key={msg.id} 
                  msg={msg} 
                  active={selectedId === msg.id} 
                  onPress={() => {
                    setSelectedId(msg.id);
                    handleMarkAsRead(msg.id);
                  }}
                  delay={300 + i * 60}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Right: Content */}
        <View style={s.detailPanel}>
          {selectedMsg ? (
            <>
              <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFill} />
              <View style={s.detailHeader}>
                <View style={s.detailIconBig}>
                  <LinearGradient colors={['#1E5A39', '#0A2318']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                  <MaterialCommunityIcons 
                    name={selectedMsg.type === 'game' ? 'dice-multiple' : selectedMsg.type === 'announcement' ? 'megaphone' : 'information'} 
                    size={24} 
                    color={C.gold} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailTitle}>{selectedMsg.title}</Text>
                  <Text style={s.detailMeta}>From: {selectedMsg.sender || 'System'} • {selectedMsg.time}</Text>
                </View>
              </View>
              
              <View style={s.divider} />
              
              <ScrollView showsVerticalScrollIndicator={false} style={s.detailScroll}>
                <Text style={s.detailText}>{selectedMsg.content}</Text>
              </ScrollView>

              <View style={s.detailFooter}>
                <TouchableOpacity style={s.footerBtn} onPress={() => handleDelete(selectedMsg.id)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF6B6B" />
                </TouchableOpacity>
                <TouchableOpacity style={s.footerBtn} onPress={() => handleToggleRead(selectedMsg.id)}>
                  <MaterialCommunityIcons 
                    name={selectedMsg.read ? "email-outline" : "email-open-outline"} 
                    size={18} 
                    color={selectedMsg.read ? C.textMuted : C.gold} 
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.textMuted }}>Select a message to read</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    gap: 20,
  },
  eyebrow: { color: C.gold, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  catWrap: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 12, gap: 4, flex: 1, maxWidth: 400 },
  catBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  catBtnActive: { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder },
  catText: { color: C.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  catTextActive: { color: C.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  mainGrid: { flex: 1, flexDirection: 'row', gap: 8 },
  listPanel: { flex: 1, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  detailPanel: { flex: 1.4, backgroundColor: C.surfaceStrong, borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder, overflow: 'hidden', padding: 20 },
  msgCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)', gap: 12, borderWidth: 1, borderColor: 'transparent' },
  msgCardActive: { backgroundColor: C.goldSoft, borderColor: C.goldBorder },
  msgIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  unreadPulse: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, borderWidth: 2, borderColor: '#0A2318' },
  msgTitle: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  msgTitleUnread: { color: C.textPrimary, fontWeight: '800' },
  msgPreviewText: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  msgTimeSmall: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '700' },
  detailHeader: { flexDirection: 'row', gap: 15, alignItems: 'center', marginBottom: 15 },
  detailIconBig: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  detailMeta: { color: C.gold, fontSize: 12, fontWeight: '600', opacity: 0.8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 15 },
  detailScroll: { flex: 1 },
  detailText: { color: 'rgba(245,239,216,0.8)', fontSize: 15, lineHeight: 24, letterSpacing: 0.2 },
  detailFooter: { flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  footerBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
});
