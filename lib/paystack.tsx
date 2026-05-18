import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const PAYSTACK_PUBLIC_KEY = 'pk_live_7eb6394cdd76cc2bfe956d3cc1a94085dacf0495';

type PaystackWebViewProps = {
  visible: boolean;
  email: string;
  amount: number;
  onClose: () => void;
  onSuccess: (data: { reference: string }) => void;
};

const CB_BASE = 'https://ludofusion.app/paystack';

export function PaystackWebView({ visible, email, amount, onClose, onSuccess }: PaystackWebViewProps) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setLoading(true);
      setError(null);
      doneRef.current = false;
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const kobo = Math.round(amount * 100);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <script src="https://js.paystack.co/v1/inline.js"></script>
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
      if (typeof PaystackPop === 'undefined') { setTimeout(check, 300); return; }
      var handler = PaystackPop.setup({
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
        setError(data.message || 'Payment failed');
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
        <Text style={st.title}>Pay with Paystack</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading && (
        <View style={st.loader}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={st.loaderText}>Initializing payment...</Text>
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
