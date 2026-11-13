import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDocActions } from '../components/DocActions';
import { DocumentRow } from '../components/DocumentRow';
import { EmptyState } from '../components/ui/EmptyState';
import { elevation } from '../components/ui/elevation';
import { Icon, IconName } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Txt } from '../components/ui/Txt';
import { useDocumentFlows } from '../hooks/useDocumentFlows';
import type { TabScreenProps } from '../navigation/types';
import { TEMPLATES } from '../services/templates';
import { useDocuments } from '../store/DocumentsProvider';
import { useTheme } from '../theme/ThemeProvider';
import type { ModuleKey } from '../theme/tokens';
import { formatLongDate, greeting } from '../utils/format';
import { KIND_MODULE } from '../components/docVisuals';

interface QuickAction {
  key: ModuleKey;
  icon: IconName;
  title: string;
  subtitle: string;
  onPress(): void;
}

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { docs, ready } = useDocuments();
  const { openDoc, createAndOpen, createFromTemplate } = useDocumentFlows();
  const { showActions, element: actionsElement } = useDocActions();

  const recents = useMemo(() => [...docs].sort((a, b) => Math.max(b.openedAt, b.updatedAt) - Math.max(a.openedAt, a.updatedAt)).slice(0, 5), [docs]);
  const counts = useMemo(() => ({ text: docs.filter((d) => d.kind === 'text').length, sheet: docs.filter((d) => d.kind === 'sheet').length }), [docs]);

  const actions: QuickAction[] = [
    { key: 'word', icon: 'file-document-edit-outline', title: 'Document', subtitle: 'Traitement de texte', onPress: () => createAndOpen('text') },
    { key: 'sheet', icon: 'table-large', title: 'Feuille de calcul', subtitle: 'Tableur et formules', onPress: () => createAndOpen('sheet') },
    { key: 'scan', icon: 'line-scan', title: 'Scanner', subtitle: 'Photo vers texte (OCR)', onPress: () => navigation.navigate('Scanner') },
    { key: 'convert', icon: 'swap-horizontal-bold', title: 'Convertir', subtitle: 'PDF, HTML, TXT, CSV', onPress: () => navigation.navigate('Convert') },
  ];

  const contentWidth = Math.min(width, 720);
  const cardWidth = (contentWidth - 16 * 2 - 12) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Txt variant="labelSmall" muted style={{ textTransform: 'uppercase' }}>
              {formatLongDate()}
            </Txt>
            <Txt variant="display">{greeting()}</Txt>
          </View>
          <IconButton icon="cog-outline" label="Réglages" onPress={() => navigation.navigate('Settings')} background={colors.surfaceContainer} color={colors.onSurface} />
        </View>

        <Pressable
          onPress={() => navigation.navigate('Files')}
          accessibilityRole="search"
          accessibilityLabel="Rechercher dans vos documents"
          style={[styles.search, { backgroundColor: colors.surfaceHigh }]}
          android_ripple={{ color: colors.outlineVariant }}
        >
          <Icon name="magnify" size={22} color={colors.onSurfaceVariant} />
          <Txt muted style={{ flex: 1 }} numberOfLines={1}>
            Rechercher un document
          </Txt>
          <View style={[styles.countPill, { backgroundColor: colors.surfaceLowest }]}>
            <Txt variant="labelSmall" muted>
              {docs.length} fichier{docs.length > 1 ? 's' : ''}
            </Txt>
          </View>
        </Pressable>

        <SectionTitle title="Créer" />
        <View style={styles.grid}>
          {actions.map((action) => {
            const accent = colors.modules[action.key];
            return (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${action.title}, ${action.subtitle}`}
                android_ripple={{ color: accent.main + '33' }}
                style={({ pressed }) => [styles.card, { width: cardWidth, backgroundColor: accent.container, opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={[styles.cardIcon, { backgroundColor: accent.main }]}>
                  <Icon name={action.icon} size={24} color={accent.onMain} />
                </View>
                <View>
                  <Txt variant="title" color={accent.onContainer} numberOfLines={1}>
                    {action.title}
                  </Txt>
                  <Txt variant="bodySmall" color={accent.onContainer} style={{ opacity: 0.78 }} numberOfLines={1}>
                    {action.subtitle}
                  </Txt>
                </View>
                <View style={styles.cardArrow}>
                  <Icon name={action.key === 'scan' || action.key === 'convert' ? 'arrow-top-right' : 'plus'} size={20} color={accent.onContainer} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Modèles" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templates}>
          {TEMPLATES.map((template) => {
            const accent = colors.modules[KIND_MODULE[template.kind]];
            return (
              <Pressable
                key={template.id}
                onPress={() => createFromTemplate(template)}
                accessibilityRole="button"
                accessibilityLabel={`Modèle ${template.title}, ${template.description}`}
                android_ripple={{ color: colors.outlineVariant }}
                style={[styles.template, { backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant }, elevation(1, colors.shadow)]}
              >
                <View style={[styles.templateSheet, { backgroundColor: accent.container }]}>
                  <Icon name={template.icon} size={28} color={accent.main} />
                  <View style={styles.templateLines}>
                    {[0.9, 0.7, 0.8, 0.5].map((w, i) => (
                      <View key={i} style={{ height: 3, borderRadius: 2, width: `${w * 100}%`, backgroundColor: accent.main, opacity: 0.28 }} />
                    ))}
                  </View>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Txt variant="label" numberOfLines={1}>
                    {template.title}
                  </Txt>
                  <Txt variant="labelSmall" muted numberOfLines={1} style={{ fontWeight: '500' }}>
                    {template.description}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionTitle
          title="Récents"
          action={docs.length > 0 ? { label: 'Tout afficher', onPress: () => navigation.navigate('Files') } : undefined}
        />
        <View style={styles.list}>
          {ready && recents.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceLow }]}>
              <EmptyState
                icon="file-star-outline"
                title="Aucun document pour l’instant"
                message="Créez un document, une feuille de calcul ou scannez une page pour commencer."
              />
            </View>
          ) : (
            recents.map((doc) => <DocumentRow key={doc.id} doc={doc} showPreview onPress={() => openDoc(doc)} onMore={() => showActions(doc)} />)
          )}
        </View>

        {docs.length > 0 ? (
          <View style={styles.stats}>
            <StatPill icon="file-document-outline" label={`${counts.text} document${counts.text > 1 ? 's' : ''}`} onPress={() => navigation.navigate('Files', { filter: 'text' })} />
            <StatPill icon="table" label={`${counts.sheet} feuille${counts.sheet > 1 ? 's' : ''}`} onPress={() => navigation.navigate('Files', { filter: 'sheet' })} />
          </View>
        ) : null}
      </ScrollView>

      {actionsElement}
    </View>
  );
}

function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress(): void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Txt variant="titleLarge" accessibilityRole="header">
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={action.label}>
          <Txt variant="label" color={colors.primary}>
            {action.label}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatPill({ icon, label, onPress }: { icon: IconName; label: string; onPress(): void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.stat, { borderColor: colors.outlineVariant }]} android_ripple={{ color: colors.outlineVariant }}>
      <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
      <Txt variant="label" muted>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  search: { marginHorizontal: 16, marginTop: 18, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, gap: 12, overflow: 'hidden' },
  countPill: { paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  card: { height: 132, borderRadius: 24, padding: 16, justifyContent: 'space-between', overflow: 'hidden' },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardArrow: { position: 'absolute', top: 16, right: 16, opacity: 0.7 },
  templates: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  template: { width: 132, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  templateSheet: { height: 96, padding: 12, justifyContent: 'space-between' },
  templateLines: { gap: 5 },
  list: { paddingHorizontal: 16, gap: 8 },
  emptyCard: { borderRadius: 24 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
});
