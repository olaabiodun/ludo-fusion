import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { PaystackProvider, usePaystack } from "react-native-paystack-webview";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C, rs } from '../components/WhotUtils';
import { playButtonSound } from './sounds';
import { supabase } from './supabase';

const PaymentForm = ({ onClose }: { onClose?: () => void }) => {
  const { popup } = usePaystack();
  const [billingDetail, setBillingDetail] = useState({
    billingName: "",
    billingEmail: "",
    billingMobile: "",
    amount: "",
  });

  const handleOnchange = (text: string, input: string) => {
    setBillingDetail((prevState) => ({ ...prevState, [input]: text }));
  };

  const handleSubmit = () => {
    playButtonSound();
    
    if (
      billingDetail.billingName &&
      billingDetail.billingEmail &&
      billingDetail.billingMobile &&
      billingDetail.amount
    ) {
      // For iOS stability, we close the current form/modal BEFORE opening Paystack's native modal
      if (onClose) onClose();

      setTimeout(() => {
        popup.checkout({
          email: billingDetail.billingEmail,
          amount: Number(billingDetail.amount),
          onSuccess: async (res: any) => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('transactions').insert({
                  player_id: user.id,
                  amount: Number(billingDetail.amount),
                  type: 'deposit',
                  status: 'completed',
                  description: `Paystack: ₦${billingDetail.amount} Deposit (${res.transactionRef || res.reference})`
                });
                Alert.alert("Payment Successful", `₦${billingDetail.amount} has been added to your wallet.`);
              }
            } catch (err) {
              console.error("Wallet sync error:", err);
            }
          },
          onCancel: () => {
            console.log("Transaction Cancelled");
          },
        });
      }, 300);
    } else {
      Alert.alert("Error", "Please fill in all fields before proceeding.");
    }
  };

  return (
    <ScrollView contentContainerStyle={st.scrollContent}>
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginBottom: rs(10) }}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={st.backBtn}>
              <MaterialCommunityIcons name="chevron-left" size={rs(24)} color={C.gold} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
        </View>
        <Text style={st.headerTitle}>Add Funds</Text>
        <Text style={st.headerSub}>Secure Payment via Paystack</Text>
      </View>

      <View style={st.formCard}>
        <View style={st.inputGroup}>
          <Text style={st.label}>BILLING NAME</Text>
          <View style={st.inputWrapper}>
            <MaterialCommunityIcons name="account-outline" size={18} color={C.gold} />
            <TextInput
              style={st.input}
              placeholder="Full Name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              onChangeText={(text) => handleOnchange(text, "billingName")}
              value={billingDetail.billingName}
            />
          </View>
        </View>

        <View style={st.inputGroup}>
          <Text style={st.label}>BILLING EMAIL</Text>
          <View style={st.inputWrapper}>
            <MaterialCommunityIcons name="email-outline" size={18} color={C.gold} />
            <TextInput
              style={st.input}
              placeholder="Email Address"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              onChangeText={(text) => handleOnchange(text, "billingEmail")}
              value={billingDetail.billingEmail}
            />
          </View>
        </View>

        <View style={st.inputGroup}>
          <Text style={st.label}>BILLING MOBILE</Text>
          <View style={st.inputWrapper}>
            <MaterialCommunityIcons name="phone-outline" size={18} color={C.gold} />
            <TextInput
              style={st.input}
              placeholder="Phone Number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              onChangeText={(text) => handleOnchange(text, "billingMobile")}
              value={billingDetail.billingMobile}
            />
          </View>
        </View>

        <View style={st.inputGroup}>
          <Text style={st.label}>AMOUNT (NGN)</Text>
          <View style={st.inputWrapper}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color={C.gold} />
            <TextInput
              style={st.input}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="numeric"
              onChangeText={(text) => handleOnchange(text, "amount")}
              value={billingDetail.amount}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={st.payBtn} 
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={st.payBtnText}>Proceed to Payment</Text>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const PaymentScreen = ({ onClose }: { onClose?: () => void }) => {
  return (
    <PaystackProvider publicKey="pk_live_7eb6394cdd76cc2bfe956d3cc1a94085dacf0495">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={st.container}
      >
        <PaymentForm onClose={onClose} />
      </KeyboardAvoidingView>
    </PaystackProvider>
  );
};

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    padding: rs(20),
    paddingTop: rs(30),
  },
  backBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    marginBottom: rs(30),
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: rs(24),
    fontWeight: '900',
    color: C.gold,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: rs(12),
    color: C.muted,
    marginTop: rs(4),
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: rs(24),
    padding: rs(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputGroup: {
    marginBottom: rs(16),
  },
  label: {
    fontSize: rs(9),
    fontWeight: '900',
    color: C.muted,
    marginBottom: rs(6),
    marginLeft: rs(4),
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: rs(12),
    height: rs(50),
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: rs(14),
    fontWeight: '600',
    marginLeft: rs(10),
  },
  payBtn: {
    backgroundColor: C.gold,
    height: rs(54),
    borderRadius: rs(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rs(10),
    gap: rs(8),
  },
  payBtnText: {
    color: '#000',
    fontSize: rs(15),
    fontWeight: '800',
  },
});

export default PaymentScreen;
