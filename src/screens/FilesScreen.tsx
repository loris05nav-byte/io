import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateSheet } from '../components/CreateSheet';
import { useDocActions } from '../components/DocActions';
import { DocumentRow } from '../components/DocumentRow';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { elevation } from '../components/ui/elevation';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { ListItem } from '../components/ui/ListItem';
import { Txt } from '../components/ui/Txt';
import { useDocumentFlows } from '../hooks/useDocumentFlows';
import type { TabScreenProps } from '../navigation/types';
import { useDocuments } from '../store/DocumentsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/tokens';
import type { DocMeta } from '../types';

type Filter = 'all' | 'text' | 'sheet' | 'favorite';
type Sort = 'updated' | 'title' | 'created' | 'size';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'text', label: 'Documents' },
  { key: 'sheet', label: 'Feuilles' },
  { key: 'favorite', label: 'Favoris' },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: 'updated', label: 'Dernière modification' },
  { key: 'title', label: 'Nom (A → Z)' },
  { key: 'created', label: 'Date de création' },
  { key: 'size', label: 'Taille' },
];

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function FilesScreen({ route, navigation }: TabScreenProps<'Files'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { docs, ready } = useDocuments();
  const { openDoc } = useDocumentFlows();
  const { showActions, element: actionsElement } = useDocActions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Filtre demandé par un autre écran (ex. pastilles de l'accueil).
  const requested = route.params?.filter;
  useEffect(() => {
    if (requested) {
      setFilter(requested);
      navigation.setParams({ filter: undefined });
    }
  }, [requested, navigation]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = docs.filter((doc) => {
      if (filter === 'favorite' ? !doc.favorite : filter !== 'all' && doc.kind !== filter) return false;
      return q === '' || normalize(doc.title).includes(q) || normalize(doc.preview).includes(q);
    });
    const compare: Record<Sort, (a: DocMeta, b: DocMeta) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }),
      size: (a, b) => b.size - a.size,
    };
    return filtered.sort(compare[sort]);
  }, [docs, query, filter, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Txt variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
            Fichiers
          </Txt>
          <IconButton icon="sort" label="Trier" onPress={() => setSortOpen(true)} color={colors.onSurface} />
        </View>
        <View style={[styles.search, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="magnify" size={22} color={colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un document"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="search"
            accessibilityLabel="Rechercher un document"
            style={[typography.body, styles.input, { color: colors.onSurface }]}
          />
          {query ? <IconButton icon="close" label="Effacer la recherche" onPress={() => setQuery('')} box={36} size={20} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(doc) => doc.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => <DocumentRow doc={item} showPreview onPress={() => openDoc(item)} onMore={() => showActions(item)} />}
        ListEmptyComponent={
          ready ? (
            docs.length === 0 ? (
              <EmptyState icon="folder-open-outline" title="Votre espace est vide" message="Appuyez sur « Nouveau » pour créer votre premier document." />
            ) : (
              <EmptyState icon="file-search-outline" title="Aucun résultat" message="Aucun document ne correspond à cette recherche ou à ce filtre." />
            )
          ) : undefined
        }
      />

      <Pressable
        onPress={() => setCreateOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Nouveau document"
        android_ripple={{ color: colors.onPrimaryContainer + '22' }}
        style={[styles.fab, { backgroundColor: colors.primaryContainer }, elevation(3, colors.shadow)]}
      >
        <Icon name="plus" size={24} color={colors.onPrimaryContainer} />
        <Txt variant="label" color={colors.onPrimaryContainer}>
          Nouveau
        </Txt>
      </Pressable>

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Trier par">
        {SORTS.map((s) => (
          <ListItem
            key={s.key}
            title={s.label}
            selected={sort === s.key}
            onPress={() => {
              setSort(s.key);
              setSortOpen(false);
            }}
          />
        ))}
      </BottomSheet>
      <CreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
      {actionsElement}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  search: { marginHorizontal: 16, marginTop: 8, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, gap: 10 },
  input: { flex: 1, minWidth: 0, paddingVertical: 0, height: 48, outlineWidth: 0 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 110, width: '100%', maxWidth: 720, alignSelf: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, height: 56, borderRadius: 18, paddingLeft: 16, paddingRight: 20, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
});
