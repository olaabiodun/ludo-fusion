import { FEATURE_ACTIVE } from './featureEnv';
import React from 'react';
import { PaymentView as RealPaymentView } from './paystack';

type PaymentViewProps = {
  amount: number;
  email: string;
  onSuccess: (ref: string) => void;
  onCancel: () => void;
  onDepositConfirm?: (amt: number, email: string) => void;
  visible?: boolean;
  onClose?: () => void;
  [key: string]: any;
};

export function PaymentView(props: PaymentViewProps) {
  if (!FEATURE_ACTIVE) {
    return null;
  }
  return <RealPaymentView {...props} />;
}
