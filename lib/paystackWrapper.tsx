import { GAMBLING_ENABLED } from './gamblingEnv';
import React from 'react';

type PaystackWebViewType = React.ComponentType<{
  amount: number;
  email: string;
  onSuccess: (ref: string) => void;
  onCancel: () => void;
  onDepositConfirm?: (amt: number, email: string) => void;
}>;

export const PaystackWebView: PaystackWebViewType = GAMBLING_ENABLED
  ? require('./paystack').PaystackWebView
  : () => null;
