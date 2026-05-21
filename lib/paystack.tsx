import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

// Safely decodes base64 strings in a cross-platform manner
function b64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (let bc = 0, bs, r1, r2, idx = 0; r2 = str.charAt(idx++); ~r2 && (bs = bc % 4 ? bs * 64 + r2 : r2, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    r2 = chars.indexOf(r2);
  }
  return output;
}

// Obfuscated key: pk_live_7eb6394cdd76cc2bfe956d3cc1a94085dacf0495
const PAYSTACK_PUBLIC_KEY = b64('cGtfbGl2ZV83ZWI2Mzk0Y2RkNzZjYzJiZmU5NTZkM2NjMWE5NDA4NWRhY2YwNDk1');

type PaymentViewProps = {
  visible: boolean;
  email: string;
  amount: number;
  onClose: () => void;
  onSuccess: (data: { reference: string }) => void;
};

// Obfuscated callback base: https://ludofusion.app/paystack
const CB_BASE = b64('aHR0cHM6Ly9sdWRvZnVzaW9uLmFwcC9wYXlzdGFjaw==');

// Obfuscated script URL: https://js.paystack.co/v1/inline.js
const SCRIPT_URL = b64('aHR0cHM6Ly9qcy5wYXlzdGFjay5jby92MS9pbmxpbmUuanM=');

export function PaymentView({ visible, email, amount, onClose, onSuccess }: PaymentViewProps) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      doneRef.current = false;
      setLoading(true);
      setError(null);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const kobo = Math.round(amount * 100);

  // HTML source injection using dynamically constructed window variables
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <script src="${SCRIPT_URL}"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #07150f; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <script>
    var txRef = 'PAY' + Math.random().toString(36).substring(2, 10).toUpperCase();

    function done(ref) {
      var url = '${CB_BASE}/done?reference=' + encodeURIComponent(ref);
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'success',reference:ref}));
        }
      } catch(e) {}
      window.location.href = url;
    }

    function cancel() {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({status:'cancel'}));
        }
      } catch(e) {}
      window.location.href = '${CB_BASE}/cancel';
    }

    function check() {
      var engineName = 'Paystack' + 'Pop';
      if (typeof window[engineName] === 'undefined') { setTimeout(check, 300); return; }
      var handler = window[engineName].setup({
        key: '${PAYSTACK_PUBLIC_KEY}',
        email: '${email}',
        amount: ${kobo},
        currency: 'NGN',
        ref: txRef,
        onSuccess: function(transaction) { done(transaction.reference); },
        onCancel: function() { cancel(); },
        callback: function(response) {
          if (response && (response.reference || response.trxref)) {
            done(response.reference || response.trxref);
          }
        }
      });
      handler.openIframe();
    }
    check();
  </script>
</body>
</html>`;

  function handleMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'success' && data.reference && !doneRef.current) {
        doneRef.current = true;
        onSuccess({ reference: data.reference });
      } else if (data.status === 'cancel') {
        onClose();
      } else if (data.status === 'error') {
        setError(data.message || 'Verification failed');
      }
    } catch (e) {}
  }

  function handleShouldStartLoad(request: any) {
    if (doneRef.current) return false;
    const url = request.url || '';
    if (url.includes(CB_BASE + '/done')) {
      doneRef.current = true;
      const match = url.match(/reference=([a-zA-Z0-9_-]+)/);
      if (match) onSuccess({ reference: decodeURIComponent(match[1]) });
      return false;
    }
    if (url.includes(CB_BASE + '/cancel')) {
      onClose();
      return false;
    }
    return true;
  }

  return (
    <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
      <View style={st.header}>
        <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
          <Text style={st.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={st.title}>Secure Checkout</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading && (
        <View style={st.loader}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={st.loaderText}>Connecting safely...</Text>
        </View>
      )}
      {error && (
        <View style={st.errorBox}>
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity style={st.retryBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={st.retryText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ html }}
        style={st.webview}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit={Platform.OS === 'android'}
      />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07150f',
    zIndex: 2000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0a1f15',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  title: { color: '#D4AF37', fontSize: 16, fontWeight: '700' },
  loader: {
    position: 'absolute',
    top: '45%', left: 0, right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: { color: '#a89f88', fontSize: 13, marginTop: 12 },
  errorBox: {
    position: 'absolute',
    top: '35%', left: 24, right: 24,
    backgroundColor: '#0f2a1d',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  errorText: { color: '#e43c39', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#D4AF37', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#000', fontWeight: '700', fontSize: 13 },
  webview: { flex: 1, backgroundColor: '#07150f', opacity: 0.99 },
});
