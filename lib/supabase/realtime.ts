import { supabase } from './client';

export type MerchantEvent = {
  type: 'offer.shown' | 'offer.accepted' | 'offer.declined' | 'offer.redeemed';
  offer_id: string;
  discount_amount_cents?: number;
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
