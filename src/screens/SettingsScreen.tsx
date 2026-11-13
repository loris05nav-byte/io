import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '../components/ui/AppBar';
import { Button } from '../components/ui/Button';
import { useFeedback } from '../components/ui/Feedback';
import { Icon, IconName } from '../components/ui/Icon';
import { Segmented } from '../components/ui/Segmented';
import { Txt } from '../components/ui/Txt';
import type { RootScreenProps } from '../navigation/types';
import { availableEngine } from '../services/ocr/ocrService';
import { useDocuments } from '../store/DocumentsProvider';
import { useSettings } from '../store/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';
import type { CsvSeparator, OcrLanguage, ThemeMode } from '../types';
import { formatSize } from '../utils/format';

const APP_VERSION = '1.0.0';

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { docs, deleteAll } = useDocuments();
  const { confirm, toast } = useFeedback();
  const engine = availableEngine();
  const totalSize = docs.reduce((sum, doc) => sum + doc.size, 0);

  const wipe = async () => {
    const ok = await confirm({
      title: 'Supprimer tous les documents ?',
      message: `${docs.length} document${docs.length > 1 ? 's' : ''} seront définitivement supprimés de cet appareil. Cette action est irréversible.`,
      confirmLabel: 'Tout supprimer',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAll();
      toast('Tous les documents ont été supprimés');
    } catch {
      toast('La suppression a échoué.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar title="Réglages" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <Section icon="palette-outline" title="Apparence" description="Thème clair, sombre, ou suivi automatique du système.">
          <Segmented<ThemeMode>
            value={settings.themeMode}
            onChange={(themeMode) => update({ themeMode })}
            options={[
              { value: 'system', label: 'Système', icon: 'theme-light-dark' },
              { value: 'light', label: 'Clair', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Sombre', icon: 'weather-night' },
            ]}
          />
        </Section>

        <Section
          icon="line-scan"
          title="Scanner OCR"
          description={
            engine === 'native'
              ? 'Moteur actif : Google ML Kit, intégré à l’application (fonctionne hors connexion, alphabet latin).'
              : 'Moteur actif : Tesseract. Les données de langue sont téléchargées au premier scan (connexion requise).'
          }
        >
          {engine === 'tesseract' ? (
            <Segmented<OcrLanguage>
              value={settings.ocrLanguage}
              onChange={(ocrLanguage) => update({ ocrLanguage })}
              options={[
                { value: 'fra+eng', label: 'FR + EN' },
                { value: 'fra', label: 'Français' },
                { value: 'eng', label: 'Anglais' },
              ]}
            />
          ) : null}
        </Section>

        <Section icon="file-delimited-outline" title="Export CSV" description="Le point-virgule convient à Excel en français ; la virgule est le standard international.">
          <Segmented<CsvSeparator>
            value={settings.csvSeparator}
            onChange={(csvSeparator) => update({ csvSeparator })}
            options={[
              { value: ';', label: 'Point-virgule ( ; )' },
              { value: ',', label: 'Virgule ( , )' },
            ]}
          />
        </Section>

        <Section
          icon="database-outline"
          title="Stockage"
          description={`${docs.length} document${docs.length > 1 ? 's' : ''} · ${formatSize(totalSize)}. Vos fichiers sont enregistrés uniquement sur cet appareil.`}
        >
          <Button variant="outlined" icon="trash-can-outline" label="Supprimer tous les documents" onPress={wipe} disabled={docs.length === 0} accent={{ main: colors.error, onMain: colors.onError, container: colors.errorContainer, onContainer: colors.onErrorContainer }} />
        </Section>

        <View style={styles.about}>
          <Txt variant="label" muted center>
            Folio Office · version {APP_VERSION}
          </Txt>
          <Txt variant="bodySmall" muted center>
            Traitement de texte, tableur, scanner OCR et convertisseur.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, description, children }: { icon: IconName; title: string; description: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.secondaryContainer }]}>
          <Icon name={icon} size={20} color={colors.onSecondaryContainer} />
        </View>
        <Txt variant="title" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      <Txt variant="bodySmall" muted>
        {description}
      </Txt>
      {children ? <View style={{ marginTop: 6 }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  about: { paddingVertical: 12, gap: 2 },
});
