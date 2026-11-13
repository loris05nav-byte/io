import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KIND_ICON, KIND_LABEL, KIND_MODULE } from '../components/docVisuals';
import { DocumentRow } from '../components/DocumentRow';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useFeedback } from '../components/ui/Feedback';
import { Icon, IconName } from '../components/ui/Icon';
import { Txt } from '../components/ui/Txt';
import { pickImportSource, previewOf, useDocumentFlows } from '../hooks/useDocumentFlows';
import type { TabScreenProps } from '../navigation/types';
import { ConversionSource, convert, ExportFormat, FORMATS, formatsFor } from '../services/converter/converter';
import { canSaveToDevice, saveResultToDevice, shareResult } from '../services/converter/exporter';
import { useDocuments } from '../store/DocumentsProvider';
import { useSettings } from '../store/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';

interface Selected {
  source: ConversionSource;
  /** Origine : document de l'application ou fichier importé. */
  origin: 'document' | 'file';
}

export function ConverterScreen({ route, navigation }: TabScreenProps<'Convert'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { docs, readContent, getDoc } = useDocuments();
  const { settings } = useSettings();
  const { toast } = useFeedback();
  const { createAndOpen } = useDocumentFlows();
  const accent = colors.modules.convert;

  const [selected, setSelected] = useState<Selected | null>(null);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | 'import' | 'open' | null>(null);

  const selectDocument = async (docId: string) => {
    const doc = getDoc(docId);
    if (!doc) return;
    try {
      const content = (await readContent(docId)) ?? '';
      setSelected({ source: { title: doc.title, kind: doc.kind, content }, origin: 'document' });
      setFormat(formatsFor(doc.kind)[0]);
    } catch {
      toast('Impossible de lire le document.');
    }
  };

  // Document présélectionné depuis un autre écran.
  const requested = route.params?.docId;
  useEffect(() => {
    if (requested) {
      selectDocument(requested);
      navigation.setParams({ docId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const importSource = async () => {
    if (busy) return;
    setBusy('import');
    try {
      const source = await pickImportSource();
      if (source) {
        setSelected({ source, origin: 'file' });
        setFormat(formatsFor(source.kind)[0]);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "L'import a échoué.");
    } finally {
      setBusy(null);
    }
  };

  const result = useMemo(() => {
    if (!selected) return null;
    try {
      return convert(selected.source, format, { csvSeparator: settings.csvSeparator });
    } catch {
      return null;
    }
  }, [selected, format, settings.csvSeparator]);

  const run = async (mode: 'share' | 'save') => {
    if (!result || busy) return;
    setBusy(mode);
    try {
      if (mode === 'save') {
        if (await saveResultToDevice(result)) toast(`« ${result.fileName} » enregistré`);
      } else {
        await shareResult(result);
      }
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'La conversion a échoué.');
    } finally {
      setBusy(null);
    }
  };

  const openInEditor = async () => {
    if (!selected || busy) return;
    setBusy('open');
    const { source } = selected;
    await createAndOpen(source.kind, { title: source.title, content: source.content, preview: previewOf(source.kind, source.content) });
    setBusy(null);
  };

  const sortedDocs = useMemo(() => [...docs].sort((a, b) => b.updatedAt - a.updatedAt), [docs]);
  const sourceAccent = selected ? colors.modules[KIND_MODULE[selected.source.kind]] : accent;
  const previewText = result && result.format !== 'pdf' ? result.data.slice(0, 900) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 4, marginBottom: 16 }}>
          <Txt variant="headline" accessibilityRole="header">
            Convertir
          </Txt>
          <Txt muted>Transformez un document ou un fichier vers un autre format.</Txt>
        </View>

        <Step number={1} title="Source" accent={accent} />
        {selected ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant }]}>
            <View style={styles.sourceRow}>
              <View style={[styles.sourceIcon, { backgroundColor: sourceAccent.container }]}>
                <Icon name={KIND_ICON[selected.source.kind]} size={24} color={sourceAccent.onContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="title" numberOfLines={1}>
                  {selected.source.title}
                </Txt>
                <Txt variant="bodySmall" muted>
                  {KIND_LABEL[selected.source.kind]} · {selected.origin === 'file' ? 'fichier importé' : 'document de l’application'}
                </Txt>
              </View>
              <Button variant="text" compact label="Changer" onPress={() => setSelected(null)} accent={accent} />
            </View>
            {selected.origin === 'file' ? (
              <Button
                variant="tonal"
                compact
                icon="open-in-new"
                label="Ouvrir dans l’éditeur"
                onPress={openInEditor}
                loading={busy === 'open'}
                accent={accent}
                style={{ alignSelf: 'flex-start', marginTop: 12 }}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.sourceChoices}>
            <SourceChoice icon="folder-open-outline" title="Mes documents" subtitle="Choisir un fichier créé ici" onPress={() => setPickerOpen(true)} accent={accent} />
            <SourceChoice icon="file-import-outline" title="Importer" subtitle="TXT, MD, HTML, CSV" onPress={importSource} accent={accent} busy={busy === 'import'} />
          </View>
        )}

        <Step number={2} title="Format de sortie" accent={accent} muted={!selected} />
        <View style={styles.formats}>
          {(selected ? formatsFor(selected.source.kind) : formatsFor('text')).map((id) => {
            const info = FORMATS[id];
            const active = !!selected && format === id;
            return (
              <Pressable
                key={id}
                disabled={!selected}
                onPress={() => setFormat(id)}
                accessibilityRole="radio"
                accessibilityLabel={`${info.label}, ${info.description}`}
                accessibilityState={{ selected: active, disabled: !selected }}
                android_ripple={{ color: colors.outlineVariant }}
                style={[
                  styles.format,
                  {
                    backgroundColor: active ? accent.container : colors.surfaceLowest,
                    borderColor: active ? accent.main : colors.outlineVariant,
                    borderWidth: active ? 2 : 1,
                    opacity: selected ? 1 : 0.45,
                  },
                ]}
              >
                <Icon name={info.icon as IconName} size={26} color={active ? accent.onContainer : colors.onSurfaceVariant} />
                <Txt variant="label" color={active ? accent.onContainer : colors.onSurface}>
                  {info.label}
                </Txt>
                <Txt variant="labelSmall" color={active ? accent.onContainer : colors.onSurfaceVariant} style={{ fontWeight: '500' }}>
                  .{info.ext}
                </Txt>
              </Pressable>
            );
          })}
        </View>
        {selected ? (
          <Txt variant="bodySmall" muted style={{ paddingHorizontal: 4, marginTop: 8 }}>
            {FORMATS[format].description}.
          </Txt>
        ) : null}

        <Step number={3} title="Exporter" accent={accent} muted={!selected} />
        {selected && result ? (
          <>
            <View style={[styles.preview, { backgroundColor: colors.surfaceLow, borderColor: colors.outlineVariant }]}>
              <View style={styles.previewHeader}>
                <Icon name="file-eye-outline" size={16} color={colors.onSurfaceVariant} />
                <Txt variant="labelSmall" muted numberOfLines={1} style={{ flex: 1 }}>
                  {result.fileName}
                </Txt>
              </View>
              {previewText !== null ? (
                <Txt variant="bodySmall" numberOfLines={9} style={styles.mono}>
                  {previewText.trim() === '' ? '(contenu vide)' : previewText}
                </Txt>
              ) : (
                <Txt variant="bodySmall" muted>
                  Le PDF est mis en page au moment de l’export, au format A4.
                </Txt>
              )}
            </View>
            <View style={styles.actions}>
              <Button icon="share-variant-outline" label="Convertir et partager" onPress={() => run('share')} loading={busy === 'share'} disabled={!!busy && busy !== 'share'} accent={accent} />
              {canSaveToDevice ? (
                <Button
                  variant="tonal"
                  icon="download-outline"
                  label="Enregistrer sur l’appareil"
                  onPress={() => run('save')}
                  loading={busy === 'save'}
                  disabled={!!busy && busy !== 'save'}
                  accent={accent}
                />
              ) : null}
            </View>
          </>
        ) : (
          <View style={[styles.preview, { backgroundColor: colors.surfaceLow, borderColor: colors.outlineVariant }]}>
            <Txt variant="bodySmall" muted center>
              Choisissez une source pour afficher l’aperçu et exporter.
            </Txt>
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Choisir un document">
        {sortedDocs.length === 0 ? (
          <EmptyState icon="folder-open-outline" title="Aucun document" message="Créez d’abord un document ou une feuille de calcul, ou importez un fichier." />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
            {sortedDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onPress={() => {
                  setPickerOpen(false);
                  selectDocument(doc.id);
                }}
              />
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function Step({ number, title, accent, muted }: { number: number; title: string; accent: { main: string; onMain: string }; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.step, { opacity: muted ? 0.5 : 1 }]}>
      <View style={[styles.stepBadge, { backgroundColor: muted ? colors.surfaceHighest : accent.main }]}>
        <Txt variant="labelSmall" color={muted ? colors.onSurfaceVariant : accent.onMain}>
          {number}
        </Txt>
      </View>
      <Txt variant="title" accessibilityRole="header">
        {title}
      </Txt>
    </View>
  );
}

function SourceChoice({
  icon,
  title,
  subtitle,
  onPress,
  accent,
  busy,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress(): void;
  accent: { main: string; container: string; onContainer: string };
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      android_ripple={{ color: colors.outlineVariant }}
      style={({ pressed }) => [styles.choice, { backgroundColor: accent.container, opacity: pressed || busy ? 0.8 : 1 }]}
    >
      <Icon name={icon} size={28} color={accent.main} />
      <Txt variant="title" color={accent.onContainer}>
        {title}
      </Txt>
      <Txt variant="bodySmall" color={accent.onContainer} style={{ opacity: 0.78 }}>
        {subtitle}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10, paddingHorizontal: 4 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sourceChoices: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, borderRadius: 22, padding: 16, gap: 4, overflow: 'hidden' },
  formats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  format: { flexGrow: 1, flexBasis: 96, minHeight: 92, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 10, overflow: 'hidden' },
  preview: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
  actions: { gap: 10, marginTop: 14 },
});
