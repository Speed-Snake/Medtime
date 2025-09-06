// App.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import * as WebBrowser from "expo-web-browser";

import LoginScreen from "./app/login";
import AddOrEdit from "./app/index";
import Lista from "./app/lista";
import Historial from "./app/historial";
import Perfil from "./app/perfil";
import { supabase } from "./src/lib/supabaseClient";

// 👇 crea un ref global para poder navegar desde fuera de componentes con props
export const navigationRef = createNavigationContainerRef();

type AuthUser = null | { mode: "guest" } | { mode: "user"; name?: string | null };
type AuthCtx = { user: AuthUser; signInAsGuest: () => void; signOut: () => Promise<void>; };

const AuthContext = createContext<AuthCtx | undefined>(undefined);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

WebBrowser.maybeCompleteAuthSession();

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);

  useEffect(() => {
    // restaurar sesión al abrir
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s) setUser({ mode: "user", name: s.user?.user_metadata?.full_name });
    });

    // escuchar cambios de auth (login/logout/refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] onAuthStateChange:", event);
      if (session) {
        setUser({ mode: "user", name: session.user?.user_metadata?.full_name });

        // 👇 fuerza ir a “Agregar medicamento” apenas hay sesión
        if (navigationRef.isReady()) {
          // reset evita que el usuario vuelva al login con “back”
          navigationRef.reset({
            index: 0,
            routes: [{ name: "Agregar medicamento" as const }],
          });
        }
      } else {
        setUser(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      signInAsGuest: () => setUser({ mode: "guest" }),
      signOut: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const Drawer = createDrawerNavigator();

function RootNavigator() {
  const { user } = useAuth();

  if (!user) return <LoginScreen />;

  return (
    <Drawer.Navigator initialRouteName="Agregar medicamento">
      <Drawer.Screen name="Agregar medicamento" component={AddOrEdit} />
      <Drawer.Screen name="Lista" component={Lista} />
      <Drawer.Screen name="Historial" component={Historial} />
      <Drawer.Screen name="Perfil" component={Perfil} />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* 👇 pasa el ref al contenedor */}
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
