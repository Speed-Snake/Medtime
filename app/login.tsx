// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useAuth } from "./app"; // <- deja esto así (sí, muestra warning de require cycle)
import { loginWithGoogle } from "../src/lib/auth";

const UI = {
  LOGO_WIDTH: 450,
  LOGO_HEIGHT: 450,
  LOGO_SHIFT_Y: -100,
  ACTIONS_SHIFT_Y: -150,
  ACTIONS_GAP: 20,
  SCREEN_PADDING: 24,
};

export default function LoginScreen() {
  const { signInAsGuest } = useAuth();
  const [loading, setLoading] = useState(false);

  const onGoogle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loginWithGoogle();
      // 👇 No navegamos aquí: App.tsx (onAuthStateChange) hace el reset a “Agregar medicamento”
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* LOGO */}
      <Image
        source={require("../assets/img/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* ACCIONES */}
      <View style={styles.actions}>
        {/* Google */}
        <TouchableOpacity
          onPress={onGoogle}
          disabled={loading}
          style={[
            styles.btn,
            styles.google,
            loading && styles.btnDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AntDesign name="google" size={18} color="#fff" />
              <Text style={styles.btnText}>Iniciar sesión con Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Invitado */}
        <TouchableOpacity
          onPress={signInAsGuest}
          disabled={loading}
          style={[styles.btn, styles.guest]}
        >
          <Text style={styles.btnText}>Ingresar como invitado</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: UI.SCREEN_PADDING,
    gap: 16,
    backgroundColor: "#fff",
  },
  logo: {
    width: UI.LOGO_WIDTH,
    height: UI.LOGO_HEIGHT,
    marginBottom: 12,
    transform: [{ translateY: UI.LOGO_SHIFT_Y }],
  },
  actions: {
    width: "100%",
    gap: UI.ACTIONS_GAP,
    transform: [{ translateY: UI.ACTIONS_SHIFT_Y }],
  },
  btn: {
    width: "100%",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  btnDisabled: { opacity: 0.7 },
  google: { backgroundColor: "#DB4437" },
  guest: { backgroundColor: "#9e9e9e" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
