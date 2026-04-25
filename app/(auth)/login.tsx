import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { MotiView } from 'moti';
import { signInWithPassword, signInDemo } from '../../lib/auth';
import { theme } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('E-Mail und Passwort eingeben.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await signInWithPassword(email.trim().toLowerCase(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Anmeldung fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const demo = async () => {
    setBusy(true); setError(null);
    try {
      await signInDemo();
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Demo-Anmeldung fehlgeschlagen.');
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
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={{ alignItems: 'center', marginBottom: 36 }}
        >
          <View style={{
            width: 76, height: 76, borderRadius: 22,
            backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}>
            <Text style={{ fontSize: 40 }}>💳</Text>
          </View>
          <Text style={{ color: theme.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>
            City Wallet
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 15, marginTop: 4, fontWeight: '600' }}>
            Hyperlokal · in Echtzeit
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
              PASSWORT
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
                  Anmelden
                </Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>ODER</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>

          <TouchableOpacity
            onPress={demo}
            disabled={busy}
            style={{
              backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 15,
              alignItems: 'center', borderWidth: 2, borderColor: theme.primary,
              flexDirection: 'row', gap: 8, justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '800' }}>
              Demo-Login (Jury)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28, gap: 6 }}>
          <Text style={{ color: theme.textMuted, fontSize: 14 }}>Noch kein Konto?</Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>
                Registrieren ›
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
