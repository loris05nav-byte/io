import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ConversionSource, convert, ExportFormat, FORMATS, formatsFor, wrapHtmlDocument } from '../services/converter/converter';
import { canSaveToDevice, printHtml, saveResultToDevice, shareResult } from '../services/converter/exporter';
import { useSettings } from '../store/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from './ui/BottomSheet';
import { useFeedback } from './ui/Feedback';
import type { IconName } from './ui/Icon';
import { ListItem } from './ui/ListItem';
import { Segmented } from './ui/Segmented';

interface Props {
  visible: boolean;
  onClose(): void;
  /** Fournit le contenu à jour du document au moment de l'export. */
  getSource(): Promise<ConversionSource | null>;
  title?: string;
}

type Mode = 'share' | 'save';

/** Feuille « Exporter » : choix du format puis partage, enregistrement ou impression. */
export function ExportSheet({ visible, onClose, getSource, title }: Props) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>('share');
  const [busy, setBusy] = useState<string | null>(null);
  const [kind, setKind] = useState<ConversionSource['kind']>('text');

  React.useEffect(() => {
    if (!visible) return;
    let alive = true;
    getSource().then((source) => {
      if (alive && source) setKind(source.kind);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const run = async (key: string, task: (source: ConversionSource) => Promise<string | null>) => {
    if (busy) return;
    setBusy(key);
    try {
      const source = await getSource();
      if (!source) throw new Error('Document introuvable.');
      const message = await task(source);
      onClose();
      if (message) toast(message);
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : "L'export a échoué.");
    } finally {
      setBusy(null);
    }
  };

  const exportAs = (format: ExportFormat) =>
    run(format, async (source) => {
      const result = convert(source, format, { csvSeparator: settings.csvSeparator });
      if (mode === 'save' && canSaveToDevice) {
        const saved = await saveResultToDevice(result);
        return saved ? `« ${result.fileName} » enregistré` : null;
      }
      await shareResult(result);
      return null;
    });

  const print = () =>
    run('print', async (source) => {
      await printHtml(source.kind === 'text' ? wrapHtmlDocument(source.title, source.content) : convert(source, 'html').data);
      return null;
    });

  const spinner = <ActivityIndicator size="small" color={colors.primary} />;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Exporter" subtitle={title}>
      {canSaveToDevice ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'share', label: 'Partager', icon: 'share-variant-outline' },
              { value: 'save', label: 'Enregistrer', icon: 'download-outline' },
            ]}
          />
        </View>
      ) : null}
      {formatsFor(kind).map((format) => {
        const info = FORMATS[format];
        return (
          <ListItem
            key={format}
            icon={info.icon as IconName}
            title={`${info.label} (.${info.ext})`}
            subtitle={info.description}
            onPress={() => exportAs(format)}
            disabled={!!busy && busy !== format}
            trailing={busy === format ? spinner : undefined}
          />
        );
      })}
      <ListItem
        icon="printer-outline"
        title="Imprimer"
        subtitle="Envoyer vers une imprimante"
        onPress={print}
        disabled={!!busy && busy !== 'print'}
        trailing={busy === 'print' ? spinner : undefined}
      />
    </BottomSheet>
  );
}
