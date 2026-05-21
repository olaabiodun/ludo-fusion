import { AppBackground } from '@/components/AppBackground';
import { supabase } from '@/lib/supabase';
import { getRandomAvatar } from '@/lib/avatars';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';
import { Path, Svg } from 'react-native-svg';
import { useFeatureActive } from '@/lib/FeatureContext';

// ─── Tokens ────────────────────────────────────────────────────────────────
const C = {
  gold: '#D4AF37',
  goldDark: '#B8962E',
  goldDeep: '#8A6A00',
  red: '#E43C39',
  redDark: '#A80015',
  green: '#39C65B',
  bgDeep: '#05110B',
  bgCard: '#0A2318',
  bgPanel: '#0D2A1C',
  bgRidge: '#113224',
  border: 'rgba(212,175,55,0.15)',
  borderHi: 'rgba(212,175,55,0.3)',
  textMain: '#F0F0F0',
  textMuted: '#A0B0A8',
  textDim: '#3A4D42',
  white: '#FFFFFF',
};

// ─── Tiny SVG-style icon components ────────────────────────────────────────
const GoogleIcon = () => (
  <View style={styles.socialIconBg}>
    <Svg width="16" height="16" viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  </View>
);

const AppleIcon = () => (
  <View style={[styles.socialIconBg, { backgroundColor: '#000' }]}>
    <Ionicons name="logo-apple" size={18} color="#FFF" />
  </View>
);

const FacebookIcon = () => (
  <View style={[styles.socialIconBg, { backgroundColor: '#1877F2' }]}>
    <Ionicons name="logo-facebook" size={18} color="#FFF" />
  </View>
);

// ─── Sparkle particles ──────────────────────────────────────────────────────
const SPARKLES = [
  { left: '5%', top: 2, size: 3, delay: 0, dur: 1800 },
  { left: '15%', top: 18, size: 2, delay: 300, dur: 2200 },
  { left: '30%', top: 0, size: 4, delay: 600, dur: 1600 },
  { left: '45%', top: 22, size: 2, delay: 100, dur: 2000 },
  { left: '55%', top: 4, size: 3, delay: 500, dur: 1900 },
  { left: '70%', top: 20, size: 2, delay: 800, dur: 2100 },
  { left: '80%', top: 6, size: 3, delay: 200, dur: 1700 },
  { left: '90%', top: 14, size: 2, delay: 400, dur: 2300 },
  { left: '25%', top: 28, size: 2, delay: 700, dur: 1500 },
  { left: '65%', top: 30, size: 3, delay: 900, dur: 2000 },
  { left: '10%', top: 10, size: 2, delay: 1100, dur: 1800 },
  { left: '85%', top: 26, size: 2, delay: 1000, dur: 2200 },
];

function Sparkle({ left, top, size, delay, dur }: typeof SPARKLES[0]) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: dur * 0.4, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -8, duration: dur * 0.4, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: dur * 0.6, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 4, duration: dur * 0.6, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: left as any,
        top,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: C.gold,
        opacity,
        transform: [{ translateY }],
        shadowColor: C.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      }}
    />
  );
}

function TitleSparkles() {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}
    </>
  );
}

// ─── Pulsing dot ────────────────────────────────────────────────────────────
function LiveDot({ color = C.green }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[styles.liveDot, { backgroundColor: color, transform: [{ scale }] }]}
    />
  );
}

// ─── Ticker ─────────────────────────────────────────────────────────────────
const WINS_REAL = 'Chidi_Kings won ₦45,000  •  Oluwa_Femi won ₦12,500  •  Nkechi_P won ₦8,500  •  Abiola_W won ₦22,000  •  Tunde_Legend won ₦50,000  •  Zainab_G won ₦18,000  •  Eze_Money won ₦100,000  •  Bolaji_Rocks won ₦3,200     ';
const WINS_COINS = 'Chidi_Kings won 45,000 coins  •  Oluwa_Femi won 12,500 coins  •  Nkechi_P won 8,500 coins  •  Abiola_W won 22,000 coins  •  Tunde_Legend won 50,000 coins  •  Zainab_G won 18,000 coins  •  Eze_Money won 100,000 coins  •  Bolaji_Rocks won 3,200 coins     ';

function Ticker({ gamblingEnabled }: { gamblingEnabled: boolean }) {
  const tx = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = React.useState(0);
  const WINS = gamblingEnabled ? WINS_REAL : WINS_COINS;

  useEffect(() => {
    if (textWidth > 0) {
      Animated.loop(
        Animated.timing(tx, {
          toValue: -textWidth,
          duration: textWidth * 25, // Constant speed relative to width
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [textWidth]);

  return (
    <View style={styles.ticker}>
      <View style={styles.tickerBadge}>
        <LiveDot color={C.white} />
        <Text style={styles.tickerBadgeText}>LIVE WINS</Text>
      </View>
      <View style={styles.tickerTrack}>
        <Animated.Text
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && !textWidth) setTextWidth(w / 2);
          }}
          style={[
            styles.tickerText,
            {
              transform: [{ translateX: tx }],
              width: 5000, // Large enough to prevent wrapping
            },
          ]}
          numberOfLines={1}
        >
          {WINS + WINS}
        </Animated.Text>
      </View>
    </View>
  );
}

// ─── Custom Modal Alert ─────────────────────────────────────────────────────
function ModalAlert({ visible, title, message, onClose }: { visible: boolean, title: string, message: string, onClose: () => void }) {
  if (!visible) return null;
  
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <View style={styles.alertHeader}>
            <Ionicons name="warning-outline" size={24} color={C.gold} />
            <Text style={styles.alertTitle}>{title}</Text>
          </View>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertBtn} onPress={onClose}>
            <Text style={styles.alertBtnText}>OKAY</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({
  visible, email, setEmail, loading, onSignIn, onClose,
}: {
  visible: boolean; email: string; setEmail: (v: string) => void; loading: boolean;
  onSignIn: () => void; onClose: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000, opacity: opacityAnim }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ width: '90%', maxWidth: 400, backgroundColor: 'rgba(5, 16, 11, 0.94)', borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.28)', padding: 24, gap: 20, transform: [{ scale: scaleAnim }] }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.gold + '15', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="email-outline" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>Sign in with Email</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>Enter your email to get started</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="close" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Email Input */}
          <View style={{ height: 48, paddingHorizontal: 14, backgroundColor: C.bgPanel, borderWidth: 1, borderColor: C.border, borderRadius: 6, justifyContent: 'center' }}>
            <TextInput
              style={{ flex: 1, color: C.textMain, fontSize: 14, fontWeight: '600' }}
              placeholder="Enter your email address"
              placeholderTextColor={C.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={{ height: 48, backgroundColor: C.gold, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 4, borderBottomColor: C.goldDark, borderRightWidth: 1, borderRightColor: C.goldDark, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.4)', opacity: loading ? 0.7 : 1 }}
            onPress={onSignIn}
            disabled={loading}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: C.bgDeep, letterSpacing: 2 }}>{loading ? '...' : 'SIGN IN'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── OTP Modal ────────────────────────────────────────────────────────────────
function OTPModal({
  visible, otp, setOtp, email, loading, onVerify, onBack,
}: {
  visible: boolean; otp: string; setOtp: (v: string) => void; email: string; loading: boolean;
  onVerify: () => void; onBack: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000, opacity: opacityAnim }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ width: '90%', maxWidth: 400, backgroundColor: 'rgba(5, 16, 11, 0.94)', borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.28)', padding: 24, gap: 20, transform: [{ scale: scaleAnim }] }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={16} color={C.textMuted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>Verify OTP</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>Code sent to {email}</Text>
            </View>
          </View>

          {/* OTP Boxes */}
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: 44, height: 50, borderRadius: 10, backgroundColor: C.bgPanel, borderWidth: 1, borderColor: otp.length === i ? C.gold : C.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800' }}>{otp[i] || ''}</Text>
              </View>
            ))}
            <TextInput
              style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.02, color: 'transparent' }}
              value={otp}
              onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
          style={{ height: 48, backgroundColor: C.gold, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 4, borderBottomColor: C.goldDark, borderRightWidth: 1, borderRightColor: C.goldDark, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.4)', opacity: (loading || otp.length < 6) ? 0.6 : 1 }}
          onPress={onVerify}
          disabled={loading || otp.length < 6}
        >
          <Text style={{ fontSize: 12, fontWeight: '900', color: C.bgDeep, letterSpacing: 2 }}>{loading ? '...' : 'VERIFY CODE'}</Text>
        </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({
  visible, username, setUsername, fullName, setFullName, isUsernameAvailable, loading, onSave,
}: {
  visible: boolean; username: string; setUsername: (v: string) => void; fullName: string; setFullName: (v: string) => void;
  isUsernameAvailable: boolean | null; loading: boolean; onSave: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000, opacity: opacityAnim }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ width: '90%', maxWidth: 400, backgroundColor: 'rgba(5, 16, 11, 0.94)', borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.28)', padding: 24, gap: 20, transform: [{ scale: scaleAnim }] }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.gold + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-outline" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>Setup Profile</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>Tell us about yourself</Text>
            </View>
          </View>

          {/* Username Input */}
          <View style={{ height: 48, paddingHorizontal: 14, backgroundColor: C.bgPanel, borderWidth: 1, borderColor: C.border, borderRadius: 6, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={{ flex: 1, color: C.textMain, fontSize: 14, fontWeight: '600' }}
              placeholder="Pick a unique username (min 4 chars)"
              placeholderTextColor={C.textDim}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoFocus
            />
            {isUsernameAvailable === true && <Ionicons name="checkmark-circle" size={18} color={C.green} />}
            {isUsernameAvailable === false && <Ionicons name="close-circle" size={18} color={C.red} />}
          </View>

          {/* Full Name Input */}
          <View style={{ height: 48, paddingHorizontal: 14, backgroundColor: C.bgPanel, borderWidth: 1, borderColor: C.border, borderRadius: 6, justifyContent: 'center' }}>
            <TextInput
              style={{ flex: 1, color: C.textMain, fontSize: 14, fontWeight: '600' }}
              placeholder="Enter your full name"
              placeholderTextColor={C.textDim}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={{ height: 48, backgroundColor: C.gold, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 4, borderBottomColor: C.goldDark, borderRightWidth: 1, borderRightColor: C.goldDark, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.4)', opacity: (loading || isUsernameAvailable === false || username.length < 4) ? 0.6 : 1 }}
            onPress={onSave}
            disabled={loading || isUsernameAvailable === false || username.length < 4}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: C.bgDeep, letterSpacing: 2 }}>{loading ? '...' : 'CONTINUE'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── Social Button ───────────────────────────────────────────────────────────
function SocialBtn({
  label,
  icon,
  onPress,
  accentColor,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accentColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.socialBtn]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {icon}
        <Text style={styles.socialBtnLabel}>{label}</Text>
        <View style={styles.socialArrow}>
          <Text style={styles.socialArrowText}>→</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const gamblingEnabled = useFeatureActive();
  console.log("[DEBUG] LoginScreen gamblingEnabled status:", gamblingEnabled);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  // Auth State
  const [step, setStep] = React.useState<'email' | 'otp' | 'profile'>('email');
  const [email, setEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedOtp, setGeneratedOtp] = React.useState('');
  const [isUsernameAvailable, setIsUsernameAvailable] = React.useState<boolean | null>(null);
  const [emailModalVisible, setEmailModalVisible] = React.useState(false);

  // Custom Alert State
  const [customAlert, setCustomAlert] = React.useState({ visible: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setCustomAlert({ visible: true, title, message });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1, duration: 1000, useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0, duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const goHome = () => router.replace('/home');

  const handleSendEmail = async () => {
    if (!email.includes('@')) return showAlert('Invalid Email', 'Please enter a valid email address');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          shouldCreateUser: true,
        }
      });
      
      if (error) throw error;
      setStep('otp');
      setEmailModalVisible(false);
    } catch (e: any) {
      showAlert('Email Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    if (otp.length < 6) return showAlert('Invalid OTP', 'Please enter the 6-digit code');

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });
      
      if (error) throw error;
      if (!data.user) throw new Error('Verification failed');

      // Check if user has a profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile || !profile.username || !profile.full_name) {
        if (profile?.username) setUsername(profile.username);
        if (profile?.full_name) setFullName(profile.full_name);
        setStep('profile');
      } else {
        goHome();
      }
    } catch (e: any) {
      showAlert('Verification Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length >= 4) {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('username', username)
          .maybeSingle();

        if (!data) {
          setIsUsernameAvailable(true); // Name is free
        } else if (user && data.id === user.id) {
          setIsUsernameAvailable(true); // It's their own name
        } else {
          setIsUsernameAvailable(false); // Taken by someone else
        }
      } else {
        setIsUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleCompleteProfile = async () => {
    Keyboard.dismiss();
    if (username.length < 4) return showAlert('Error', 'Username must be at least 4 characters');
    if (isUsernameAvailable === false) return showAlert('Error', 'This username is already taken');

    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated. Please log in again.');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          full_name: fullName,
          avatar_url: getRandomAvatar(),
          updated_at: new Date(),
        });

      if (error) throw error;

      // Auto-login to home
      goHome();
    } catch (e: any) {
      showAlert('Profile Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground overlayOpacity={0.92}>
      <StatusBar hidden />

      <DodgeKeyboard>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={step === 'profile'} // Only enable scroll if needed, or always
        >
          {/* ── TOP BAR ── */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.shieldIcon}>
                <Text style={{ fontSize: 9, color: C.green }}>✓</Text>
              </View>
              <Text style={styles.secureText}>CERTIFIED SECURE &amp; FAIR PLAY</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/offline')} style={styles.offlineBtn}>
              <Text style={styles.offlineBtnText}>PLAY OFFLINE</Text>
            </TouchableOpacity>
          </View>

          {/* ── MAIN LAYOUT ── */}
          <Animated.View
            style={[
              styles.mainRow,
              { opacity: fadeIn, transform: [{ translateY: slideUp }] },
            ]}
          >

            <View style={styles.leftCol}>
              <Image
                key={gamblingEnabled ? 'gambling-hero' : 'masked-hero'}
                source={gamblingEnabled ? require('@/assets/images/ludo_fusion.jpg') : require('@/assets/images/ludo-fusion1.png')}
                style={styles.leftColImage}
                contentFit={gamblingEnabled ? 'fill' : 'contain'}
                transition={500}
              />
            </View>

            {/* ── VERTICAL SEPARATOR ── */}
            <View style={styles.separator} />

            {/* ── RIGHT COLUMN ── */}
            <View style={styles.rightCol}>
              {/* ... existing content ... */}

              <View style={{ position: 'relative', marginBottom: 4 }}>
                <TitleSparkles />
                <Text style={styles.authTitle}>
                  {step === 'profile' ? 'SETUP YOUR ' : 'JOIN THE '}
                  <Text style={styles.authTitleGold}>{step === 'profile' ? 'PROFILE' : 'ELITE'}</Text>
                </Text>
              </View>
              <Text style={styles.authSub}>
                {step === 'email' && 'One-tap login — start winning in seconds'}
                {step === 'otp' && `We've sent a 6-digit code to ${email}`}
                {step === 'profile' && (gamblingEnabled ? 'Tell us your name to claim your ₦500 bonus' : 'Tell us your name to claim your 500 coins bonus')}
              </Text>

              {/* Social buttons - Only show in email step */}
              {step === 'email' && (
                <>
                  <View style={styles.socialStack}>
                    <SocialBtn
                      label="Continue with Google"
                      icon={<GoogleIcon />}
                      onPress={goHome}
                      accentColor="#DB4437"
                    />
                    <SocialBtn
                      label="Continue with Apple"
                      icon={<AppleIcon />}
                      onPress={goHome}
                      accentColor={C.white}
                    />
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerLabel}>OR USE EMAIL</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <SocialBtn
                    label="Continue with Email"
                    icon={
                      <View style={styles.socialIconBg}>
                        <MaterialCommunityIcons name="email-outline" size={16} color={C.gold} />
                      </View>
                    }
                    onPress={() => setEmailModalVisible(true)}
                    accentColor={C.gold}
                  />
                </>
              )}

              {/* Email Modal Popup */}
              <EmailModal
                visible={emailModalVisible}
                email={email}
                setEmail={setEmail}
                loading={loading}
                onSignIn={handleSendEmail}
                onClose={() => setEmailModalVisible(false)}
              />

              {/* OTP Modal */}
              <OTPModal
                visible={step === 'otp'}
                otp={otp}
                setOtp={setOtp}
                email={email}
                loading={loading}
                onVerify={handleVerifyOtp}
                onBack={() => setStep('email')}
              />

              {/* Profile Modal */}
              <ProfileModal
                visible={step === 'profile'}
                username={username}
                setUsername={setUsername}
                fullName={fullName}
                setFullName={setFullName}
                isUsernameAvailable={isUsernameAvailable}
                loading={loading}
                onSave={handleCompleteProfile}
              />

              {/* Terms */}
              <Text style={styles.termsText}>
                By logging in you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}&amp;{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>.
                {' '}You confirm you are 18+{gamblingEnabled ? '. Gamble responsibly' : ''}.
              </Text>

            </View>
          </Animated.View>
        </ScrollView>
      </DodgeKeyboard>
      {/* ── TICKER ── */}
      {gamblingEnabled && <Ticker gamblingEnabled={gamblingEnabled} />}

      <ModalAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        onClose={() => setCustomAlert({ ...customAlert, visible: false })}
      />
    </AppBackground>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // TOP BAR
  topBar: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    backgroundColor: C.bgDeep,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shieldIcon: {
    width: 16, height: 16,
    backgroundColor: 'rgba(0,209,108,0.12)',
    borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,209,108,0.3)',
    marginLeft: 7
  },
  secureText: { fontSize: 8, fontWeight: '900', color: C.green, letterSpacing: 2, },
  offlineBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,208,48,0.5)',
    borderRadius: 50,
    backgroundColor: 'rgba(255,208,48,0.06)',
    marginRight: 7
  },
  offlineBtnText: { fontSize: 8, fontWeight: '900', color: C.gold, letterSpacing: 1.5 },

  // MAIN ROW
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  // LEFT COL
  leftCol: {
    width: 490,
    backgroundColor: C.bgCard,
    borderRightWidth: 1,
    borderRightColor: C.borderHi,
    overflow: 'hidden',
  },
  leftColImage: {
    flex: 1,
    width: '100%',
  },

  brandBlock: { gap: 0 },
  brandEyebrow: {
    fontSize: 8, fontWeight: '900',
    color: C.gold, letterSpacing: 2.5,
    marginBottom: 4,
  },
  brandName: {
    fontSize: 60, fontWeight: '900',
    color: C.textMain, lineHeight: 56,
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  brandTagline: {
    fontSize: 9, fontWeight: '800',
    color: C.textMuted, letterSpacing: 2,
    marginTop: 8,
  },

  jackpotCard: {
    flexDirection: 'row',
    backgroundColor: C.bgRidge,
    borderWidth: 1, borderColor: C.borderHi,
    borderRadius: 6,
    overflow: 'hidden',
  },
  jackpotEdge: { width: 4, backgroundColor: C.gold },
  jackpotInner: { flex: 1, padding: 14 },
  jpLabel: {
    fontSize: 8, fontWeight: '900',
    color: C.textMuted, letterSpacing: 2,
    marginBottom: 6,
  },
  jpAmount: {
    fontSize: 30, fontWeight: '900',
    color: C.gold, letterSpacing: 0.5,
    textShadowColor: 'rgba(255,208,48,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  jpLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  jpLiveText: { fontSize: 8, fontWeight: '800', color: C.green, letterSpacing: 1 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.bgPanel,
    borderWidth: 1, borderColor: C.borderHi,
    borderRadius: 6, overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 8 },
  statVal: { fontSize: 15, fontWeight: '900', color: C.textMain, letterSpacing: 0.5 },
  statLbl: { fontSize: 7, fontWeight: '800', color: C.textMuted, letterSpacing: 1.5, marginTop: 2 },

  // SEPARATOR
  separator: { width: 1, backgroundColor: C.border },

  // RIGHT COL
  rightCol: {
    flex: 1,
    paddingHorizontal: 34,
    paddingVertical: 4,
    justifyContent: 'center',
    backgroundColor: C.bgDeep,
  },

  authTitle: {
    fontSize: 30, fontWeight: '900',
    color: C.textMain, letterSpacing: 3,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowRadius: 0,
  },
  authTitleGold: {
    color: C.gold,
    textShadowColor: C.goldDark,
  },
  authSub: {
    fontSize: 11, fontWeight: '500',
    color: C.textMuted,
    marginBottom: 22,
    letterSpacing: 0.3,
  },

  socialStack: { gap: 6, marginBottom: 18 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: C.bgPanel,
    borderWidth: 0.5, borderColor: C.borderHi,
    borderRadius: 50,
    paddingHorizontal: 14,
    gap: 12,
  },
  socialIconBg: {
    width: 28, height: 28,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  gLetter: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  socialBtnLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: C.textMain, letterSpacing: 0.3 },
  socialArrow: {
    width: 22, height: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  socialArrowText: { fontSize: 12, color: C.textMuted, marginBottom: 5 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontSize: 9, fontWeight: '900', color: C.textMuted, letterSpacing: 2 },

  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  phonePrefixBox: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: C.bgPanel,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 6,
    justifyContent: 'center',
  },
  phonePrefixText: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  phoneInputBox: {
    flex: 1, height: 42,
    paddingHorizontal: 14,
    backgroundColor: C.bgPanel,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 6,
    justifyContent: 'center',
  },
  phoneInputPlaceholder: { fontSize: 12, color: C.textDim },
  textInput: {
    flex: 1,
    color: C.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  otpBtn: {
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: C.gold,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: C.goldDark,
    borderRightWidth: 1,
    borderRightColor: C.goldDark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  otpBtnText: { fontSize: 11, fontWeight: '900', color: C.bgDeep, letterSpacing: 2 },

  termsText: { 
    fontSize: 10, 
    fontWeight: '500', 
    color: C.textDim, 
    textAlign: 'center', 
    lineHeight: 16, 
    marginTop: 20, 
    paddingHorizontal: 20 
  },
  termsLink: { color: C.gold, fontWeight: '800' },

  // TICKER
  ticker: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgDeep,
    borderTopWidth: 1,
    borderTopColor: C.borderHi,
    overflow: 'hidden',
    marginLeft: 7
  },
  tickerBadge: {
    height: '100%',
    paddingHorizontal: 12,
    backgroundColor: C.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tickerBadgeText: { fontSize: 8, fontWeight: '900', color: C.white, letterSpacing: 2, marginLeft: 7 },
  tickerTrack: { flex: 1, overflow: 'hidden' },
  tickerText: { fontSize: 9, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },

  // CUSTOM ALERT STYLES
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderHi,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    // 3D Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.gold,
    letterSpacing: 1,
  },
  alertMessage: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textMain,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  alertBtn: {
    width: '100%',
    height: 48,
    backgroundColor: C.gold,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: C.goldDark,
  },
  alertBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: C.bgDeep,
    letterSpacing: 2,
  },

  // OTP BOXES
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  backBtnText: { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 1 },

  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    position: 'relative'
  },
  otpBox: {
    flex: 1,
    height: 54,
    backgroundColor: C.bgPanel,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: C.gold,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  otpBoxFilled: {
    borderColor: 'rgba(212,175,55,0.4)',
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: '900',
    color: C.gold,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.02,
    color: 'transparent',
  },
});
