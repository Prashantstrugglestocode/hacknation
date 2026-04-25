import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { MotiView } from 'moti';
import { signUpWithPassword } from '../../lib/auth';
import { theme } from '../../lib/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('E-Mail und Passwort eingeben.');
      return;
    }
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await signUpWithPassword(email.trim().toLowerCase(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Registrierung fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
        </TouchableOpacity>

        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={{ marginBottom: 28 }}
        >
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
            REGISTRIEREN
          </Text>
          <Text style={{ color: theme.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>
            Konto erstellen
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
            E-Mail genügt. Wir nutzen sie nur, um deine Angebote über Geräte hinweg zu synchronisieren.
          </Text>
        </MotiView>

        <View style={{ gap: 14 }}>
          <View>
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 }}>
              E-MAIL
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholder="du@beispiel.de"
              placeholderTextColor={theme.textMuted}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 }}>
              PASSWORT (MIN. 6 ZEICHEN)
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              style={inputStyle}
            />
          </View>

          {error ? (
            <View style={{
              backgroundColor: theme.danger + '11', borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: theme.danger + '44',
            }}>
              <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '700' }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={submit}
            disabled={busy}
            style={{
              backgroundColor: busy ? theme.primaryWash : theme.primary,
              borderRadius: 16, paddingVertical: 17, alignItems: 'center',
              shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
              marginTop: 6,
            }}
          >
            {busy
              ? <ActivityIndicator color={theme.textOnPrimary} />
              : <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 }}>
                  Konto erstellen
                </Text>}
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28, gap: 6 }}>
          <Text style={{ color: theme.textMuted, fontSize: 14 }}>Schon ein Konto?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>
                Anmelden ›
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  color: theme.text, fontSize: 16,
  borderWidth: 1, borderColor: theme.border,
} as const;
