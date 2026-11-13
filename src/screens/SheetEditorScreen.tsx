import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';

import { ColorPalette } from '../components/ColorPalette';
import { ExportSheet } from '../components/ExportSheet';
import { Ribbon, RibbonTab } from '../components/Ribbon';
import { Grid } from '../components/sheet/Grid';
import { AppBar } from '../components/ui/AppBar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useFeedback } from '../components/ui/Feedback';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { ListItem } from '../components/ui/ListItem';
import { Txt } from '../components/ui/Txt';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import type { RootScreenProps } from '../navigation/types';
import { cellKey, formatNumber, rangeKey } from '../services/spreadsheet/formula';
import {
  addCols,
  addRows,
  applyStyle,
  clearRange,
  colWidth,
  computeValues,
  deleteCol,
  deleteRow,
  detectAutoRange,
  insertCol,
  insertRow,
  isMultiSelection,
  parseSheet,
  Selection,
  selectionBounds,
  selectionStats,
  setCellValue,
  setColWidth,
  sheetPreview,
} from '../services/spreadsheet/sheetModel';
import { useDocuments } from '../store/DocumentsProvider';
import { useTheme } from '../theme/ThemeProvider';
import type { CellFormat, CellStyle, SheetContent } from '../types';

type SheetKey = 'color' | 'fill' | 'format' | 'functions' | 'menu' | null;

const FORMATS: { value: CellFormat; label: string; example: string }[] = [
  { value: 'general', label: 'Général', example: '1234,5' },
  { value: 'number', label: 'Nombre', example: '1 234,50' },
  { value: 'currency', label: 'Monétaire', example: '1 234,50 €' },
  { value: 'percent', label: 'Pourcentage', example: '12,5 %' },
];

const FUNCTION_HELP: { name: string; description: string }[] = [
  { name: 'SOMME', description: 'Additionne les nombres d’une plage' },
  { name: 'MOYENNE', description: 'Moyenne arithmétique' },
  { name: 'MIN', description: 'Plus petite valeur' },
  { name: 'MAX', description: 'Plus grande valeur' },
  { name: 'NB', description: 'Nombre de cellules numériques' },
  { name: 'NBVAL', description: 'Nombre de cellules non vides' },
  { name: 'MEDIANE', description: 'Valeur médiane' },
  { name: 'PRODUIT', description: 'Multiplie les nombres' },
  { name: 'ARRONDI', description: 'Arrondit : ARRONDI(nombre; décimales)' },
  { name: 'SI', description: 'Condition : SI(test; si vrai; si faux)' },
  { name: 'ABS', description: 'Valeur absolue' },
  { name: 'RACINE', description: 'Racine carrée' },
  { name: 'CONCAT', description: 'Assemble des textes' },
  { name: 'AUJOURDHUI', description: 'Date du jour' },
];

const SAVE_DELAY = 600;
const HISTORY_LIMIT = 60;
/** Caractères après lesquels un appui sur une cellule insère sa référence dans la formule. */
const REF_TRIGGER = /[=(+\-*/^&;,:<>]$/;

const single = (row: number, col: number): Selection => ({ row, col, endRow: row, endCol: col });

export function SheetEditorScreen({ route, navigation }: RootScreenProps<'SheetEditor'>) {
  const { docId } = route.params;
  const { colors } = useTheme();
  const { getDoc, readContent, writeContent, renameDoc, toggleFavorite, deleteDoc, markOpened } = useDocuments();
  const { toast, prompt, confirm } = useFeedback();
  const keyboardVisible = useKeyboardVisible();
  const accent = colors.modules.sheet;
  const doc = getDoc(docId);

  const [sheet, setSheet] = useState<SheetContent | null>(null);
  const [selection, setSelection] = useState<Selection>(single(0, 0));
  const [editing, setEditingState] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('home');
  const [panel, setPanel] = useState<SheetKey>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });

  const input = useRef<TextInputInstance>(null);
  /** Miroir synchrone de `editing` : l'événement de focus peut arriver avant le rendu suivant. */
  const editingRef = useRef(false);
  const setEditing = useCallback((value: boolean) => {
    editingRef.current = value;
    setEditingState(value);
  }, []);
  const undoStack = useRef<SheetContent[]>([]);
  const redoStack = useRef<SheetContent[]>([]);
  const sheetRef = useRef<SheetContent | null>(null);
  const dirty = useRef(false);
  const deleted = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Dernière référence insérée dans la formule par un appui sur une cellule. */
  const lastRef = useRef<{ text: string; row: number; col: number } | null>(null);

  /* ---------------- Chargement et enregistrement ---------------- */

  useEffect(() => {
    let alive = true;
    markOpened(docId);
    readContent(docId)
      .then((content) => {
        if (!alive) return;
        const parsed = parseSheet(content);
        sheetRef.current = parsed;
        setSheet(parsed);
      })
      .catch(() => {
        if (!alive) return;
        const empty = parseSheet(null);
        sheetRef.current = empty;
        setSheet(empty);
        toast('Impossible de lire la feuille.');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const save = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const current = sheetRef.current;
    if (!dirty.current || !current || deleted.current) return;
    dirty.current = false;
    try {
      await writeContent(docId, JSON.stringify(current), sheetPreview(current));
    } catch {
      dirty.current = true;
      toast("L'enregistrement a échoué.");
    }
    setSaving(dirty.current);
  }, [docId, writeContent, toast]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(
    () => () => {
      saveRef.current();
    },
    [],
  );

  /** Remplace la feuille par une nouvelle version (historisée et enregistrée). */
  const apply = useCallback((next: SheetContent) => {
    const current = sheetRef.current;
    if (!current || next === current) return;
    undoStack.current.push(current);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    sheetRef.current = next;
    setSheet(next);
    setHistory({ undo: undoStack.current.length, redo: 0 });
    dirty.current = true;
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveRef.current(), SAVE_DELAY);
  }, []);

  const travel = (from: React.MutableRefObject<SheetContent[]>, to: React.MutableRefObject<SheetContent[]>) => {
    const target = from.current.pop();
    const current = sheetRef.current;
    if (!target || !current) return;
    to.current.push(current);
    sheetRef.current = target;
    setSheet(target);
    setEditing(false);
    setSelection((s) => single(Math.min(s.row, target.rows - 1), Math.min(s.col, target.cols - 1)));
    setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });
    dirty.current = true;
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveRef.current(), SAVE_DELAY);
  };

  const values = useMemo(() => (sheet ? computeValues(sheet) : {}), [sheet]);

  /* ---------------- Saisie ---------------- */

  const activeKey = cellKey(selection.row, selection.col);
  const activeCell = sheet?.cells[activeKey];
  const rawValue = activeCell?.v ?? '';
  const bounds = selectionBounds(selection);
  const multi = isMultiSelection(selection);

  const startEditing = (text: string) => {
    lastRef.current = null;
    setDraft(text);
    setEditing(true);
  };

  const commit = (move: 'down' | 'none' = 'none') => {
    const current = sheetRef.current;
    if (!current) return;
    if (editing) {
      apply(setCellValue(current, selection.row, selection.col, draft.trim()));
      setEditing(false);
      lastRef.current = null;
    }
    if (move === 'down') {
      const row = Math.min(selection.row + 1, current.rows - 1);
      setSelection(single(row, selection.col));
    }
  };

  const cancel = () => {
    setEditing(false);
    lastRef.current = null;
    input.current?.blur();
  };

  const onCellPress = (row: number, col: number) => {
    if (editing && draft.startsWith('=')) {
      const ref = cellKey(row, col);
      const previous = lastRef.current;
      if (previous && draft.endsWith(previous.text)) {
        // Un nouvel appui remplace la référence qui vient d'être insérée.
        setDraft(draft.slice(0, -previous.text.length) + ref);
        lastRef.current = { text: ref, row, col };
        return;
      }
      if (REF_TRIGGER.test(draft)) {
        setDraft(draft + ref);
        lastRef.current = { text: ref, row, col };
        return;
      }
    }
    if (editing) commit();
    if (!editing && !multi && selection.row === row && selection.col === col) {
      startEditing(rawValue);
      input.current?.focus();
      return;
    }
    setSelection(single(row, col));
  };

  const onCellLongPress = (row: number, col: number) => {
    const previous = lastRef.current;
    if (editing && previous && draft.endsWith(previous.text)) {
      // Dans une formule : étend la dernière référence en plage (A1 → A1:B3).
      const anchor = previous.text.split(':')[0];
      const anchorPos = { row: previous.row, col: previous.col };
      const range = rangeKey(anchorPos.row, anchorPos.col, row, col);
      setDraft(draft.slice(0, -previous.text.length) + (range.includes(':') ? range : anchor));
      lastRef.current = { text: range, row: anchorPos.row, col: anchorPos.col };
      return;
    }
    if (editing) commit();
    setSelection((s) => ({ ...s, endRow: row, endCol: col }));
  };

  /* ---------------- Mise en forme et structure ---------------- */

  const style = activeCell?.s ?? {};

  const patchStyle = (patch: Partial<CellStyle>) => {
    const current = sheetRef.current;
    if (!current) return;
    if (editing) commit();
    apply(applyStyle(sheetRef.current ?? current, bounds, patch));
  };

  const structure = (operation: (current: SheetContent) => SheetContent, nextSelection?: Selection) => {
    if (editing) commit();
    const current = sheetRef.current;
    if (!current) return;
    const next = operation(current);
    if (next === current) {
      toast('Limite de taille atteinte.');
      return;
    }
    apply(next);
    const target = nextSelection ?? single(selection.row, selection.col);
    setSelection(single(Math.min(target.row, next.rows - 1), Math.min(target.col, next.cols - 1)));
  };

  const insertFunction = (name: string) => {
    const current = sheetRef.current;
    if (!current) return;
    setPanel(null);
    if (multi && !editing) {
      // Plage sélectionnée : le résultat est placé sous la plage.
      const range = rangeKey(bounds.r1, bounds.c1, bounds.r2, bounds.c2);
      const targetRow = bounds.r2 + 1;
      const base = targetRow >= current.rows ? addRows(current, 1) : current;
      apply(setCellValue(base, targetRow, bounds.c2, `=${name}(${range})`));
      setSelection(single(targetRow, bounds.c2));
      return;
    }
    if (editing) {
      setDraft(draft === '' ? `=${name}(` : `${draft}${name}(`);
    } else {
      const auto = name === 'AUJOURDHUI' ? '' : detectAutoRange(current, values, selection.row, selection.col);
      startEditing(name === 'AUJOURDHUI' ? '=AUJOURDHUI()' : auto ? `=${name}(${auto})` : `=${name}(`);
    }
    lastRef.current = null;
    input.current?.focus();
  };

  /* ---------------- Menu ---------------- */

  const rename = async () => {
    const title = await prompt({ title: 'Renommer la feuille', initialValue: doc?.title, placeholder: 'Nom de la feuille', confirmLabel: 'Renommer' });
    if (title?.trim()) renameDoc(docId, title);
  };

  const remove = async () => {
    setPanel(null);
    const ok = await confirm({ title: 'Supprimer cette feuille ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', destructive: true });
    if (!ok) return;
    deleted.current = true;
    await deleteDoc(docId);
    navigation.goBack();
  };

  const pick = (action: () => void) => () => {
    setPanel(null);
    action();
  };

  const stats = useMemo(() => (multi ? selectionStats(values, bounds) : null), [multi, values, bounds.r1, bounds.r2, bounds.c1, bounds.c2]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sheet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBar title={doc?.title ?? 'Feuille de calcul'} subtitle="Ouverture…" onBack={() => navigation.goBack()} />
        <View style={styles.loader}>
          <ActivityIndicator color={accent.main} size="large" />
        </View>
      </View>
    );
  }

  const width = colWidth(sheet, selection.col);
  const formatLabel = FORMATS.find((f) => f.value === (style.format ?? 'general'))?.label ?? 'Général';
  const fn = (name: string): RibbonTab['items'][number] => ({ type: 'dropdown', key: name, text: name, label: `Insérer ${name}`, plain: true, onPress: () => insertFunction(name) });

  const tabs: RibbonTab[] = [
    {
      key: 'home',
      label: 'Accueil',
      items: [
        { type: 'button', key: 'bold', icon: 'format-bold', label: 'Gras', active: !!style.bold, onPress: () => patchStyle({ bold: !style.bold }) },
        { type: 'button', key: 'italic', icon: 'format-italic', label: 'Italique', active: !!style.italic, onPress: () => patchStyle({ italic: !style.italic }) },
        { type: 'button', key: 'underline', icon: 'format-underline', label: 'Souligné', active: !!style.underline, onPress: () => patchStyle({ underline: !style.underline }) },
        { type: 'divider', key: 'd1' },
        { type: 'button', key: 'left', icon: 'format-align-left', label: 'Aligner à gauche', active: style.align === 'left', onPress: () => patchStyle({ align: style.align === 'left' ? undefined : 'left' }) },
        { type: 'button', key: 'center', icon: 'format-align-center', label: 'Centrer', active: style.align === 'center', onPress: () => patchStyle({ align: style.align === 'center' ? undefined : 'center' }) },
        { type: 'button', key: 'right', icon: 'format-align-right', label: 'Aligner à droite', active: style.align === 'right', onPress: () => patchStyle({ align: style.align === 'right' ? undefined : 'right' }) },
        { type: 'divider', key: 'd2' },
        { type: 'button', key: 'color', icon: 'format-color-text', label: 'Couleur du texte', swatch: style.color ?? colors.onSurface, onPress: () => setPanel('color') },
        { type: 'button', key: 'fill', icon: 'format-color-fill', label: 'Couleur de remplissage', swatch: style.bg ?? null, onPress: () => setPanel('fill') },
        { type: 'divider', key: 'd3' },
        { type: 'dropdown', key: 'format', text: formatLabel, label: 'Format de nombre', icon: 'numeric', onPress: () => setPanel('format') },
        { type: 'button', key: 'clear', icon: 'eraser', label: 'Effacer le contenu', onPress: () => { if (editing) cancel(); const current = sheetRef.current; if (current) apply(clearRange(current, bounds)); } },
      ],
    },
    {
      key: 'formulas',
      label: 'Formules',
      items: [
        { type: 'button', key: 'fx', icon: 'function-variant', label: 'Toutes les fonctions', onPress: () => setPanel('functions') },
        { type: 'divider', key: 'd1' },
        fn('SOMME'),
        fn('MOYENNE'),
        fn('MIN'),
        fn('MAX'),
        fn('NB'),
      ],
    },
    {
      key: 'structure',
      label: 'Lignes et colonnes',
      items: [
        { type: 'button', key: 'row-above', icon: 'table-row-plus-before', label: 'Insérer une ligne au-dessus', onPress: () => structure((s) => insertRow(s, bounds.r1), single(bounds.r1, selection.col)) },
        { type: 'button', key: 'row-below', icon: 'table-row-plus-after', label: 'Insérer une ligne en dessous', onPress: () => structure((s) => insertRow(s, bounds.r2 + 1), single(bounds.r2 + 1, selection.col)) },
        { type: 'button', key: 'row-delete', icon: 'table-row-remove', label: 'Supprimer la ligne', onPress: () => structure((s) => deleteRow(s, selection.row)) },
        { type: 'divider', key: 'd1' },
        { type: 'button', key: 'col-left', icon: 'table-column-plus-before', label: 'Insérer une colonne à gauche', onPress: () => structure((s) => insertCol(s, bounds.c1), single(selection.row, bounds.c1)) },
        { type: 'button', key: 'col-right', icon: 'table-column-plus-after', label: 'Insérer une colonne à droite', onPress: () => structure((s) => insertCol(s, bounds.c2 + 1), single(selection.row, bounds.c2 + 1)) },
        { type: 'button', key: 'col-delete', icon: 'table-column-remove', label: 'Supprimer la colonne', onPress: () => structure((s) => deleteCol(s, selection.col)) },
        { type: 'divider', key: 'd2' },
        { type: 'button', key: 'narrow', icon: 'arrow-collapse-horizontal', label: 'Réduire la colonne', onPress: () => { const current = sheetRef.current; if (current) apply(setColWidth(current, selection.col, width - 24)); } },
        { type: 'button', key: 'widen', icon: 'arrow-expand-horizontal', label: 'Élargir la colonne', onPress: () => { const current = sheetRef.current; if (current) apply(setColWidth(current, selection.col, width + 24)); } },
      ],
    },
  ];

  const rangeLabel = multi ? rangeKey(bounds.r1, bounds.c1, bounds.r2, bounds.c2) : activeKey;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title={doc?.title ?? 'Feuille de calcul'}
        subtitle={saving ? 'Enregistrement…' : 'Enregistré'}
        onBack={() => {
          if (editing) commit();
          navigation.goBack();
        }}
        onTitlePress={rename}
        actions={
          <>
            <IconButton icon="undo" label="Annuler" disabled={history.undo === 0} onPress={() => travel(undoStack, redoStack)} color={colors.onSurface} box={40} />
            <IconButton icon="redo" label="Rétablir" disabled={history.redo === 0} onPress={() => travel(redoStack, undoStack)} color={colors.onSurface} box={40} />
            <IconButton icon="export-variant" label="Exporter" onPress={() => { if (editing) commit(); setExportOpen(true); }} color={colors.onSurface} box={40} />
            <IconButton icon="dots-vertical" label="Plus d'options" onPress={() => setPanel('menu')} color={colors.onSurface} box={40} />
          </>
        }
      />

      <View style={[styles.formulaBar, { backgroundColor: colors.surfaceLow, borderColor: editing ? accent.main : colors.outlineVariant }]}>
        <View style={[styles.nameBox, { backgroundColor: accent.container }]}>
          <Txt variant="label" color={accent.onContainer} numberOfLines={1}>
            {rangeLabel}
          </Txt>
        </View>
        <Icon name="function-variant" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          ref={input}
          value={editing ? draft : rawValue}
          onChangeText={(text) => {
            lastRef.current = null;
            if (!editing) setEditing(true);
            setDraft(text);
          }}
          onFocus={() => {
            if (!editingRef.current) startEditing(rawValue);
          }}
          onSubmitEditing={() => commit('down')}
          submitBehavior="submit"
          returnKeyType="next"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="Saisir une valeur ou =formule"
          placeholderTextColor={colors.outline}
          accessibilityLabel={`Contenu de la cellule ${activeKey}`}
          style={[styles.input, { color: colors.onSurface }]}
        />
        {editing ? (
          <>
            <IconButton icon="close" label="Annuler la saisie" onPress={cancel} box={36} size={20} color={colors.error} />
            <IconButton icon="check" label="Valider la saisie" onPress={() => { commit(); input.current?.blur(); }} box={36} size={20} color={accent.main} />
          </>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Grid
          sheet={sheet}
          values={values}
          selection={selection}
          accent={accent}
          onCellPress={onCellPress}
          onCellLongPress={onCellLongPress}
          onAddRows={() => structure((s) => addRows(s, 20))}
          onAddCols={() => structure((s) => addCols(s, 3))}
        />

        <View style={[styles.status, { backgroundColor: colors.surfaceContainer, borderTopColor: colors.outlineVariant }]}>
          {stats ? (
            <Txt variant="labelSmall" numberOfLines={1} style={{ flex: 1 }}>
              Somme : {formatNumber(stats.sum)}   ·   Moyenne : {formatNumber(parseFloat(stats.average.toPrecision(8)))}   ·   Nb : {stats.count}
            </Txt>
          ) : (
            <Txt variant="labelSmall" muted numberOfLines={1} style={{ flex: 1, fontWeight: '500' }}>
              {editing && draft.startsWith('=')
                ? 'Touchez une cellule pour l’insérer'
                : 'Appui long : étendre la sélection'}
            </Txt>
          )}
          <Pressable hitSlop={8} onPress={() => setSelection(single(selection.row, selection.col))} disabled={!multi} accessibilityLabel="Réduire la sélection">
            <Txt variant="labelSmall" color={accent.main}>
              {sheet.rows} × {sheet.cols}
            </Txt>
          </Pressable>
        </View>

        <Ribbon tabs={tabs} activeTab={tab} onTabChange={setTab} accent={accent} safeBottom={!keyboardVisible} />
      </KeyboardAvoidingView>

      <BottomSheet visible={panel === 'color'} onClose={() => setPanel(null)} title="Couleur du texte">
        <ColorPalette selected={style.color} noneLabel="Automatique" onSelect={(color) => pick(() => patchStyle({ color: color ?? undefined }))()} />
      </BottomSheet>

      <BottomSheet visible={panel === 'fill'} onClose={() => setPanel(null)} title="Couleur de remplissage">
        <ColorPalette selected={style.bg} noneLabel="Aucun remplissage" onSelect={(color) => pick(() => patchStyle({ bg: color ?? undefined }))()} />
      </BottomSheet>

      <BottomSheet visible={panel === 'format'} onClose={() => setPanel(null)} title="Format de nombre">
        {FORMATS.map((format) => (
          <ListItem
            key={format.value}
            title={format.label}
            subtitle={format.example}
            selected={(style.format ?? 'general') === format.value}
            onPress={pick(() => patchStyle({ format: format.value === 'general' ? undefined : format.value }))}
          />
        ))}
      </BottomSheet>

      <BottomSheet visible={panel === 'functions'} onClose={() => setPanel(null)} title="Fonctions" subtitle="Les noms anglais (SUM, AVERAGE, IF…) sont aussi acceptés.">
        {FUNCTION_HELP.map((item) => (
          <ListItem key={item.name} icon="function-variant" title={item.name} subtitle={item.description} onPress={() => insertFunction(item.name)} />
        ))}
      </BottomSheet>

      <BottomSheet visible={panel === 'menu'} onClose={() => setPanel(null)} title={doc?.title} subtitle={`${sheet.rows} lignes × ${sheet.cols} colonnes`}>
        <ListItem icon="pencil-outline" title="Renommer" onPress={pick(rename)} />
        <ListItem
          icon={doc?.favorite ? 'star-off-outline' : 'star-outline'}
          title={doc?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onPress={pick(() => toggleFavorite(docId))}
        />
        <ListItem icon="export-variant" title="Exporter / convertir" subtitle="CSV, PDF, HTML, TXT, Markdown" onPress={pick(() => { if (editing) commit(); setExportOpen(true); })} />
        <ListItem icon="table-row-plus-after" title="Ajouter 20 lignes" onPress={pick(() => structure((s) => addRows(s, 20)))} />
        <ListItem icon="table-column-plus-after" title="Ajouter 3 colonnes" onPress={pick(() => structure((s) => addCols(s, 3)))} />
        <ListItem icon="trash-can-outline" title="Supprimer" destructive onPress={remove} />
      </BottomSheet>

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title={doc?.title}
        getSource={async () => ({ title: doc?.title ?? 'Feuille de calcul', kind: 'sheet', content: JSON.stringify(sheetRef.current ?? sheet) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formulaBar: { marginHorizontal: 10, marginBottom: 8, height: 48, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 4, gap: 8 },
  nameBox: { minWidth: 52, height: 34, borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 44, fontSize: 15, paddingVertical: 0, outlineWidth: 0 },
  status: { height: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
