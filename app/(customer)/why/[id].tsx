import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Constants from 'expo-constants';
import { forgetMe } from '../../../lib/privacy/intent-encoder';
import { PRIVACY_DISCLOSURE } from '../../../lib/privacy/disclosure';
import i18n, { getLocale } from '../../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

export default function WhyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [offer, setOffer] = useState<any>(null);
  const [forgotDone, setForgotDone] = useState(false);
  const locale = getLocale();
  const disclosure = PRIVACY_DISCLOSURE[locale];

  useEffect(() => {
    fetch(`${API}/api/offer/${id}`)
      .then(r => r.json())
      .then(setOffer)
      .catch(() => {});
  }, [id]);

  const handleForgetMe = async () => {
    await forgetMe();
    setForgotDone(true);
  };

  const chips: string[] = offer?.widget_spec?.signal_chips ?? [];
  const reasoning: string = offer?.widget_spec?.reasoning ?? '';
  const contextState = offer?.context_state ?? {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0A0A0F' }} contentContainerStyle={{ padding: 24, gap: 24 }}>
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: '#6C63FF', fontSize: 15, marginBottom: 8 }}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
        {i18n.t('customer.why')}
      </Text>

      {/* Signal chips */}
      {chips.length > 0 && (
        <View>
          <Text style={{ color: '#ffffff99', fontSize: 13, marginBottom: 10, fontWeight: '600', letterSpacing: 1 }}>
            SIGNALE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((chip, i) => (
              <View key={i} style={{ backgroundColor: '#6C63FF22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#6C63FF44' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Reasoning */}
      {reasoning ? (
        <View style={{ backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16 }}>
          <Text style={{ color: '#ffffff99', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 6 }}>
            {i18n.t('customer.reasoning_title').toUpperCase()}
          </Text>
          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>{reasoning}</Text>
        </View>
      ) : null}

      {/* What we sent */}
      <View>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 10 }}>
          {i18n.t('customer.what_we_sent').toUpperCase()}
        </Text>
        <View style={{ backgroundColor: '#0F0F1A', borderRadius: 14, padding: 14 }}>
          <Text style={{ color: '#A0A0CC', fontSize: 12, fontFamily: 'monospace', lineHeight: 20 }}>
            {JSON.stringify(contextState, null, 2)}
          </Text>
        </View>
      </View>

      {/* Privacy disclosure */}
      <View style={{ backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{disclosure.title}</Text>
        <Text style={{ color: '#ffffff99', fontSize: 13, lineHeight: 20 }}>{disclosure.body}</Text>
        <Text style={{ color: '#6C63FF', fontSize: 12, marginTop: 4 }}>✓ {disclosure.what_stays}</Text>
        <Text style={{ color: '#ffffff66', fontSize: 12 }}>↑ {disclosure.what_sent}</Text>
      </View>

      {/* Forget me */}
      {forgotDone ? (
        <Text style={{ color: '#6C63FF', textAlign: 'center', fontSize: 14 }}>
          Verlauf gelöscht. Dein Gerätekennzeichen wurde rotiert.
        </Text>
      ) : (
        <TouchableOpacity
          onPress={handleForgetMe}
          style={{ backgroundColor: '#FF6B6B22', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FF6B6B44' }}
        >
          <Text style={{ color: '#FF6B6B', fontSize: 15, fontWeight: '700' }}>
            {i18n.t('customer.forget_me')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
