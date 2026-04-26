import { supabase } from './client';

export type MerchantEvent = {
  type: 'offer.shown' | 'offer.accepted' | 'offer.declined' | 'offer.redeemed';
  offer_id: string;
  discount_amount_cents?: number;
  redemption_kind?: 'qr' | 'cashback';
  ts: string;
};

export function subscribeMerchantChannel(
  merchantId: string,
  onEvent: (event: MerchantEvent) => void
) {
  const channel = supabase.channel(`merchant:${merchantId}`)
    .on('broadcast', { event: '*' }, (payload) => {
      onEvent(payload.payload as MerchantEvent);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Per-offer channel — used by the customer redeem screen so the QR card
// can morph into a payment-confirmation receipt the moment the merchant
// scans the QR. Server broadcasts on this channel from /redeem-qr.
export function subscribeOfferChannel(
  offerId: string,
  onEvent: (event: MerchantEvent) => void
) {
  const channel = supabase.channel(`offer:${offerId}`)
    .on('broadcast', { event: '*' }, (payload) => {
      onEvent(payload.payload as MerchantEvent);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
