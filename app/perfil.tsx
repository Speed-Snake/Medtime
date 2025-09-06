// app/perfil.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, Image } from 'react-native';
import { supabase } from '../src/lib/supabaseClient';

type AuthInfo = {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  avatarUrl?: string | null;
  hasSession: boolean;
};

export default function Perfil() {
  const [info, setInfo] = useState<AuthInfo>({ hasSession: false });

  const load = async () => {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    const session = s.session ?? null;
    const user = u.user ?? null;

    const provider =
      (user?.identities && user.identities[0]?.provider) ||
      (user?.app_metadata?.provider as string | undefined) ||
      null;

    const next: AuthInfo = {
      hasSession: !!session,
      email: user?.email ?? null,
      name: (user?.user_metadata as any)?.full_name ?? null,
      avatarUrl: (user?.user_metadata as any)?.avatar_url ?? null,
      provider,
    };

    console.log('[Perfil] session?', next.hasSession, 'email:', next.email, 'provider:', next.provider);
    setInfo(next);

    Alert.alert(
      'Estado de sesión',
      next.hasSession
        ? `✅ Logeado como ${next.email ?? '(sin email)'} via ${next.provider ?? 'desconocido'}`
        : '❌ No hay sesión'
    );
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={s.container}>
      <Text style={s.title}>Mi perfil</Text>

      {info.avatarUrl ? (
        <Image source={{ uri: info.avatarUrl }} style={s.avatar} />
      ) : null}

      <Text style={s.row}>Sesión: {info.hasSession ? 'Activa ✅' : 'No activa ❌'}</Text>
      <Text style={s.row}>Email: {info.email ?? '—'}</Text>
      <Text style={s.row}>Nombre: {info.name ?? '—'}</Text>
      <Text style={s.row}>Proveedor: {info.provider ?? '—'}</Text>

      <View style={{ height: 12 }} />
      <Button title="Comprobar sesión" onPress={load} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  row: { fontSize: 16, marginTop: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
});
