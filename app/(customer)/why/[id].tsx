import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Constants from 'expo-constants';
import { forgetMe } from '../../../lib/privacy/intent-encoder';
import { PRIVACY_DISCLOSURE } from '../../../lib/privacy/disclosure';
import { theme } from '../../../lib/theme';
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22, gap: 20 }}>
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>TRANSPARENZ</Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
          {i18n.t('customer.why')}
        </Text>
      </View>

      {chips.length > 0 && (
        <View>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 10, fontWeight: '800', letterSpacing: 1 }}>
            SIGNALE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((chip, i) => (
              <View key={i} style={{
                backgroundColor: theme.primaryWash, borderRadius: 999,
                paddingHorizontal: 14, paddingVertical: 7,
                borderWidth: 1, borderColor: theme.primary + '55',
              }}>
                <Text style={{ color: theme.primaryDark, fontSize: 13, fontWeight: '700' }}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {reasoning ? (
        <View style={{
          backgroundColor: theme.bgMuted, borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: theme.border,
        }}>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>
            {i18n.t('customer.reasoning_title').toUpperCase()}
          </Text>
          <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{reasoning}</Text>
        </View>
      ) : null}

      <View>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 }}>
          {i18n.t('customer.what_we_sent').toUpperCase()}
        </Text>
        <View style={{
          backgroundColor: '#1F1F23', borderRadius: 14, padding: 14,
        }}>
          <Text style={{ color: '#FECACA', fontSize: 11, fontFamily: 'Courier', lineHeight: 17 }}>
            {JSON.stringify(contextState, null, 2)}
          </Text>
        </View>
      </View>

      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 8,
        borderWidth: 1, borderColor: theme.border,
      }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>{disclosure.title}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 20 }}>{disclosure.body}</Text>
        <Text style={{ color: theme.success, fontSize: 12, marginTop: 4, fontWeight: '700' }}>✓ {disclosure.what_stays}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>↑ {disclosure.what_sent}</Text>
      </View>

      {forgotDone ? (
        <View style={{
          backgroundColor: theme.primaryWash, padding: 14, borderRadius: 14, alignItems: 'center',
          borderWidth: 1, borderColor: theme.primary + '66',
        }}>
          <Text style={{ color: theme.primaryDark, textAlign: 'center', fontSize: 14, fontWeight: '700' }}>
            ✓ Verlauf gelöscht. Gerätekennzeichen rotiert.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleForgetMe}
          style={{
            backgroundColor: theme.danger + '11', borderRadius: 14,
            paddingVertical: 15, alignItems: 'center',
            borderWidth: 1, borderColor: theme.danger + '44',
          }}
        >
          <Text style={{ color: theme.danger, fontSize: 15, fontWeight: '800' }}>
            {i18n.t('customer.forget_me')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
