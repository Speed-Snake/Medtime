# 🚀 Guía de Configuración - MedTime Expo Dev Client

## ✅ Estado: FUNCIONANDO
**Fecha:** 01-10-2025  
**Commit:** 6dc75d8 - WORKING: Expo Dev Client con ExpoCrypto solucionado

## 📋 Configuración del Sistema

### **Java 21**
- **Ubicación:** `C:\Program Files\Java\jdk-21`
- **Variable:** `JAVA_HOME=C:\Program Files\Java\jdk-21`
- **Verificar:** `java -version` → Java 21.0.7

### **Android SDK**
- **Ubicación:** `C:\Users\PC\AppData\Local\Android\Sdk`
- **Variable:** `ANDROID_HOME=C:\Users\PC\AppData\Local\Android\Sdk`
- **PATH:** `%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator`

### **Archivo local.properties**
```
sdk.dir=C:\\Users\\PC\\AppData\\Local\\Android\\Sdk
```

## 🔧 Dependencias Instaladas

### **Principales:**
- `expo-crypto@15.0.7` ✅
- `expo-dev-client@5.2.4` ✅
- `react-native-get-random-values` ✅

### **Módulos nativos compilados:**
- expo-crypto (15.0.7)
- expo-dev-client (5.2.4)
- expo-notifications (0.31.4)
- expo-av (15.1.7)
- expo-file-system (18.1.11)

## 🚀 Comandos para Ejecutar

### **1. Configurar variables de entorno:**
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:ANDROID_HOME = "C:\Users\PC\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
```

### **2. Limpiar build (si es necesario):**
```bash
cd android
.\gradlew clean
cd ..
```

### **3. Ejecutar app:**
```bash
npx expo run:android
```

## 🎯 Solución del Error ExpoCrypto

**Problema:** `Cannot find native module 'ExpoCrypto'`

**Solución aplicada:**
1. ✅ Instalar Java 21
2. ✅ Configurar Android SDK
3. ✅ Crear `android/local.properties`
4. ✅ Instalar `expo-crypto@15.0.7`
5. ✅ Limpiar build con `gradlew clean`
6. ✅ Recompilar con módulos nativos

## 📱 Emulador

**Nombre:** Medium_Phone_API_36.1  
**API Level:** 36.1 (Android 16.0)  
**Estado:** ✅ Funcionando

## 🔄 Restaurar desde Backup

```bash
git clone [URL_DEL_REPOSITORIO]
cd Medtime-main
npm install
# Configurar variables de entorno (ver arriba)
npx expo run:android
```

## ⚠️ Notas Importantes

- **NO usar** `npx expo start` (solo para Expo Go)
- **Siempre usar** `npx expo run:android` para Dev Client
- **Variables de entorno** deben configurarse en cada sesión
- **Emulador** debe estar iniciado antes de ejecutar

---
**✅ CONFIGURACIÓN COMPLETADA Y FUNCIONANDO** 🎉




