import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TesseractEngine, TesseractHandle } from '../components/ocr/TesseractEngine';
import { AppBar } from '../components/ui/AppBar';
import { Button } from '../components/ui/Button';
import { useFeedback } from '../components/ui/Feedback';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Txt } from '../components/ui/Txt';
import type { RootScreenProps } from '../navigation/types';
import { countWords } from '../services/converter/markup';
import { availableEngine, cleanOcrText, ocrTextToHtml, recognizeNative } from '../services/ocr/ocrService';
import { setPendingInsert } from '../services/ocr/pendingInsert';
import { useDocuments } from '../store/DocumentsProvider';
import { useSettings } from '../store/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/tokens';
import { formatShortDate } from '../utils/format';

type Stage = 'camera' | 'processing' | 'result';

interface Capture {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Chargement du moteur…',
  'initializing tesseract': 'Initialisation…',
  'loading language traineddata': 'Téléchargement des langues…',
  'initializing api': 'Préparation…',
  'recognizing text': 'Lecture du texte…',
};

export function ScannerScreen({ route, navigation }: RootScreenProps<'Scanner'>) {
  const insertInto = route.params?.insertInto;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { settings } = useSettings();
  const { createDoc, getDoc } = useDocuments();
  const { toast } = useFeedback();
  const accent = colors.modules.scan;

  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const tesseract = useRef<TesseractHandle>(null);
  const [engine] = useState(availableEngine);
  const [stage, setStage] = useState<Stage>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage !== 'processing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stage, scanLine]);

  const analyse = async (shot: Capture) => {
    const id = ++runId.current;
    setCapture(shot);
    setProgress(null);
    setStage('processing');
    try {
      let recognized: string;
      if (engine === 'native') {
        recognized = await recognizeNative(shot.uri);
      } else {
        if (!shot.base64) throw new Error("Impossible de lire l'image.");
        const dataUrl = `data:${shot.mimeType ?? 'image/jpeg'};base64,${shot.base64}`;
        const raw = await tesseract.current!.recognize(dataUrl, settings.ocrLanguage, (value, status) => {
          if (runId.current === id) setProgress({ value, label: STATUS_LABELS[status] ?? 'Analyse…' });
        });
        recognized = cleanOcrText(raw);
      }
      if (runId.current !== id) return;
      setText(recognized);
      setStage('result');
    } catch (error) {
      if (runId.current !== id) return;
      toast(error instanceof Error && error.message ? error.message : 'La reconnaissance du texte a échoué.');
      setStage('camera');
    }
  };

  const takePicture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7, base64: engine === 'tesseract', shutterSound: false });
      await analyse({ uri: photo.uri, base64: photo.base64, mimeType: 'image/jpeg' });
    } catch {
      toast('La prise de vue a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: engine === 'tesseract' });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await analyse({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
    } catch {
      toast("Impossible d'ouvrir la galerie.");
    }
  };

  const retake = () => {
    runId.current++;
    setStage('camera');
    setText('');
    setCapture(null);
  };

  const useText = async () => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (insertInto) {
      setPendingInsert(insertInto, clean);
      navigation.goBack();
      return;
    }
    setBusy(true);
    try {
      const meta = await createDoc('text', {
        title: `Scan du ${formatShortDate()}`,
        content: ocrTextToHtml(clean),
        preview: clean.replace(/\s+/g, ' ').slice(0, 160),
      });
      navigation.replace('WordEditor', { docId: meta.id });
    } catch {
      toast('Impossible de créer le document.');
      setBusy(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    toast('Texte copié');
  };

  const engineElement = engine === 'tesseract' ? <TesseractEngine ref={tesseract} /> : null;

  /* ---------------- Résultat ---------------- */

  if (stage === 'result') {
    const words = countWords(text);
    const target = insertInto ? getDoc(insertInto) : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBar
          title="Texte reconnu"
          subtitle={words > 0 ? `${words} mot${words > 1 ? 's' : ''} · vérifiez et corrigez si besoin` : 'Aucun texte détecté'}
          onBack={() => navigation.goBack()}
          actions={<IconButton icon="content-copy" label="Copier le texte" onPress={copy} disabled={!text.trim()} color={colors.onSurface} />}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.resultBody}>
            {capture ? (
              <View style={[styles.thumbRow, { backgroundColor: colors.surfaceContainer }]}>
                <Image source={{ uri: capture.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
                <View style={{ flex: 1 }}>
                  <Txt variant="label">Page numérisée</Txt>
                  <Txt variant="bodySmall" muted>
                    {engine === 'native' ? 'Reconnaissance sur l’appareil (ML Kit)' : 'Reconnaissance Tesseract'}
                  </Txt>
                </View>
                <Button variant="tonal" compact icon="camera-retake-outline" label="Reprendre" onPress={retake} accent={accent} />
              </View>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              placeholder="Aucun texte n’a été détecté. Reprenez la photo avec un meilleur éclairage, ou saisissez le texte ici."
              placeholderTextColor={colors.outline}
              accessibilityLabel="Texte reconnu, modifiable"
              style={[typography.body, styles.textArea, { color: colors.onSurface, backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant }]}
            />
          </View>
          <View style={[styles.resultActions, { paddingBottom: insets.bottom + 12, borderTopColor: colors.outlineVariant, backgroundColor: colors.surfaceLow }]}>
            <Button
              style={{ flex: 1 }}
              icon={insertInto ? 'file-import-outline' : 'file-document-plus-outline'}
              label={insertInto ? `Insérer dans « ${target?.title ?? 'le document'} »` : 'Créer un document'}
              onPress={useText}
              disabled={!text.trim()}
              loading={busy}
              accent={accent}
            />
          </View>
        </KeyboardAvoidingView>
        {engineElement}
      </View>
    );
  }

  /* ---------------- Caméra et analyse ---------------- */

  const granted = permission?.granted;
  const translateY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, 280] });

  return (
    <View style={styles.cameraRoot}>
      <StatusBar style="light" />
      {stage === 'processing' && capture ? (
        <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={2} accessibilityIgnoresInvertColors />
      ) : granted && focused ? (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setCameraReady(true)} />
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="close" label="Fermer le scanner" onPress={() => navigation.goBack()} color="#fff" background="rgba(0,0,0,0.45)" />
        <View style={styles.badge}>
          <Icon name="line-scan" size={16} color="#fff" />
          <Txt variant="label" color="#fff">
            Scanner OCR
          </Txt>
        </View>
        {stage === 'camera' && granted ? (
          <IconButton
            icon={torch ? 'flashlight' : 'flashlight-off'}
            label={torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
            onPress={() => setTorch((v) => !v)}
            color={torch ? '#1B1C22' : '#fff'}
            background={torch ? '#FFD76A' : 'rgba(0,0,0,0.45)'}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {stage === 'processing' ? (
        <View style={styles.center}>
          <View style={styles.frame}>
            <Corners color={accent.main} />
            <Animated.View style={[styles.scanLine, { backgroundColor: accent.main, transform: [{ translateY }] }]} />
          </View>
          <View style={styles.processingCard}>
            <ActivityIndicator color="#fff" />
            <View>
              <Txt variant="label" color="#fff">
                {progress?.label ?? 'Analyse du texte…'}
              </Txt>
              {progress && progress.value > 0 ? (
                <Txt variant="labelSmall" color="rgba(255,255,255,0.75)">
                  {Math.round(progress.value * 100)} %
                </Txt>
              ) : null}
            </View>
          </View>
          <Button variant="text" label="Annuler" onPress={retake} accent={{ ...accent, main: '#fff' }} />
        </View>
      ) : granted ? (
        <>
          <View style={styles.center} pointerEvents="none">
            <View style={styles.frame}>
              <Corners color="#fff" />
            </View>
            <View style={styles.hint}>
              <Txt variant="bodySmall" color="#fff" center>
                Cadrez la page, bien à plat et bien éclairée
              </Txt>
            </View>
          </View>
          <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
            <IconButton icon="image-multiple-outline" label="Choisir une image dans la galerie" onPress={pickImage} color="#fff" background="rgba(255,255,255,0.18)" box={52} size={24} />
            <Pressable
              onPress={takePicture}
              disabled={!cameraReady || busy}
              accessibilityRole="button"
              accessibilityLabel="Prendre la photo"
              style={({ pressed }) => [styles.shutter, { opacity: !cameraReady || busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <View style={[styles.shutterInner, { backgroundColor: busy ? accent.main : '#fff' }]} />
            </Pressable>
            <View style={{ width: 52 }} />
          </View>
        </>
      ) : (
        <View style={[styles.center, { paddingHorizontal: 32 }]}>
          <View style={styles.permissionIcon}>
            <Icon name="camera-outline" size={36} color="#fff" />
          </View>
          <Txt variant="titleLarge" color="#fff" center>
            Accès à la caméra
          </Txt>
          <Txt variant="body" color="rgba(255,255,255,0.78)" center style={{ marginTop: 8, marginBottom: 20 }}>
            Autorisez la caméra pour photographier une page et en extraire le texte. Les images restent sur votre appareil.
          </Txt>
          {permission && !permission.granted && !permission.canAskAgain ? (
            <Button icon="cog-outline" label="Ouvrir les réglages" onPress={() => Linking.openSettings()} accent={accent} />
          ) : (
            <Button icon="camera-outline" label="Autoriser la caméra" onPress={() => requestPermission()} loading={!permission} accent={accent} />
          )}
          <Button variant="text" icon="image-multiple-outline" label="Choisir une image" onPress={pickImage} accent={{ ...accent, main: '#fff' }} style={{ marginTop: 8 }} />
        </View>
      )}
      {engineElement}
    </View>
  );
}

function Corners({ color }: { color: string }) {
  const base = { position: 'absolute' as const, width: 34, height: 34, borderColor: color };
  return (
    <>
      <View style={[base, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }]} />
      <View style={[base, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }]} />
      <View style={[base, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }]} />
    </>
  );
}

const styles = StyleSheet.create({
  cameraRoot: { flex: 1, backgroundColor: '#0B0D12' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', height: 36, paddingHorizontal: 14, borderRadius: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: '78%', maxWidth: 380, height: 300 },
  scanLine: { position: 'absolute', left: 10, right: 10, top: 8, height: 3, borderRadius: 2, opacity: 0.9 },
  hint: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  processingCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.35)' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
  permissionIcon: { width: 76, height: 76, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  resultBody: { flex: 1, paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18 },
  thumb: { width: 48, height: 60, borderRadius: 10, backgroundColor: '#000' },
  textArea: { flex: 1, outlineWidth: 0, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  resultActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
