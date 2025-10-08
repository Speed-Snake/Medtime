// src/lib/auth.ts
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { supabase } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();

/**
 * Resuelve el redirectUri:
 * - En Expo Go forzamos SIEMPRE el proxy de Expo: https://auth.expo.dev/@<owner>/<slug>
 * - En Dev Client / APK usamos tu scheme nativo: medtime://
 * (Incluye logs para verificar qué se está usando)
 */
export function getRedirectUri(): string {
  const ownership = Constants.appOwnership; // 'expo' en Expo Go
  console.log('[Auth] appOwnership =', ownership);

  if (ownership === 'expo') {
    const proxy = 'https://auth.expo.dev/@medtime/medtime';
    console.log('[Auth] redirectTo  =', proxy);
    return proxy;
  }

  const uri = AuthSession.makeRedirectUri({ scheme: 'medtime' });
  console.log('[Auth] redirectTo  =', uri);
  return uri;
}

/**
 * Login con Google usando Supabase OAuth (navegador).
 * - Abre el navegador
 * - Al volver, intenta:
 *   1) PKCE: lee ?code=... y llama exchangeCodeForSession (firma string u objeto)
 *   2) Fallback: si viene #access_token, intenta setSession
 */
export async function loginWithGoogle(): Promise<boolean> {
  try {
    const redirectTo = getRedirectUri();

    console.log('[Auth] signInWithOAuth → Supabase');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true, // abrimos el navegador manualmente
        // flow: 'pkce', // si tu versión de @supabase/supabase-js no tipa 'flow', déjalo comentado
        queryParams: { access_type: 'offline', prompt: 'consent' },
      } as any, // forzamos tipo para evitar errores TS en versiones antiguas
    });

    if (error) {
      console.log('[Auth] signInWithOAuth error →', error);
      Alert.alert('Supabase', error.message);
      return false;
    }
    if (!data?.url) {
      console.log('[Auth] signInWithOAuth sin data.url');
      Alert.alert(
        'Config',
        'Supabase no devolvió URL de login. Revisa Providers→Google (Client ID Web + Secret) y Redirect URLs en Supabase.'
      );
      return false;
    }

    console.log('[Auth] Abriendo navegador:', data.url);
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    console.log('[Auth] openAuthSessionAsync →', res);

    if (res.type !== 'success' || !res.url) {
      if (res.type === 'dismiss') Alert.alert('Login cancelado');
      return false;
    }

    // --- Intento 1: PKCE ?code=... ---
    let code: string | null = null;
    try {
      const url = new URL(res.url);
      code = url.searchParams.get('code');
    } catch (e) {
      // Si por alguna razón new URL falla, seguimos con fallback
      console.log('[Auth] new URL() falló, intentaremos fallback hash. Error:', e);
    }

    if (code) {
      console.log('[Auth] PKCE code =', code);

      // Compat: algunas versiones aceptan string, otras { authCode }
      let exData: any, exErr: any;
      try {
        console.log('[Auth] exchangeCodeForSession try {authCode}');
        const r1 = await (supabase.auth as any).exchangeCodeForSession({ authCode: code });
        exData = r1?.data; exErr = r1?.error;
      } catch (e) {
        console.log('[Auth] exchangeCodeForSession fall-back string', e);
        try {
          const r2 = await (supabase.auth as any).exchangeCodeForSession(code);
          exData = r2?.data; exErr = r2?.error;
        } catch (e2) {
          exErr = e2;
        }
      }
      console.log('[Auth] exchangeCodeForSession →', exErr ?? 'OK');

      if (exErr) {
        Alert.alert('Supabase', (exErr as any)?.message ?? String(exErr));
        return false;
      }
      // Aquí ya debería existir sesión → App.tsx verá SIGNED_IN y navegará.
      return !!exData?.session;
    }

    // --- Intento 2: Fallback #access_token=... ---
    const hash = res.url.includes('#') ? res.url.split('#')[1] : '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      console.log('[Auth] Fallback: access_token encontrado en hash');
      try {
        const r = await (supabase.auth as any).setSession?.({
          access_token: accessToken,
          refresh_token: refreshToken ?? undefined,
        });
        console.log('[Auth] setSession fallback →', r?.error ?? 'OK');
        return !!r?.data?.session;
      } catch (e) {
        console.log('[Auth] setSession fallback failed:', e);
      }
    }

    console.log('[Auth] No llegó ?code ni #access_token en el callback');
    Alert.alert('Login', 'No se recibió el código de autenticación.');
    return false;
  } catch (e: any) {
    console.log('[Auth] Exception →', e);
    Alert.alert('Error', e?.message ?? String(e));
    return false;
  }
}

export async function logout() {
  await supabase.auth.signOut();
}
