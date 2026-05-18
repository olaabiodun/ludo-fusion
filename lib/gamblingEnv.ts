import Constants from 'expo-constants';

const config: any = Constants.expoConfig?.extra?.gamblingMode || {};
// In local dev, app.json extra.gamblingMode.enabled is the source of truth
// In EAS builds, eas.json can override via EXPO_PUBLIC_* env vars
const envOverride = process.env.EXPO_PUBLIC_GAMBLING_MODE;

export const GAMBLING_ENABLED = envOverride !== undefined
  ? envOverride === 'true'
  : config.enabled !== false;

const pk = process.env.EXPO_PUBLIC_PAYSTACK_KEY;
export const PAYSTACK_PK = pk || (GAMBLING_ENABLED ? 'pk_live_7eb6394cdd76cc2bfe956d3cc1a94085dacf0495' : '');
