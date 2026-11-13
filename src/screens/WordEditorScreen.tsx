import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { BridgeHandle, BridgeWebView } from '../components/BridgeWebView';
import { ColorPalette } from '../components/ColorPalette';
import { ExportSheet } from '../components/ExportSheet';
import { Ribbon, RibbonTab } from '../components/Ribbon';
import { AppBar } from '../components/ui/AppBar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useFeedback } from '../components/ui/Feedback';
import { IconButton } from '../components/ui/IconButton';
import { ListItem } from '../components/ui/ListItem';
import {
  editorCall,
  editorHtml,
  EditorMessage,
  EditorState,
  FONT_FAMILIES,
  FONT_SIZES,
  initialEditorState,
} from '../editor/editorHtml';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import type { RootScreenProps } from '../navigation/types';
import { ocrTextToHtml } from '../services/ocr/ocrService';
import { takePendingInsert } from '../services/ocr/pendingInsert';
import { useDocuments } from '../store/DocumentsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { formatShortDate } from '../utils/format';

type SheetKey = 'size' | 'style' | 'font' | 'color' | 'highlight' | 'spacing' | 'table' | 'menu' | null;

const BLOCKS: { tag: EditorState['block']; label: string; short: string }[] = [
  { tag: 'p', label: 'Texte normal', short: 'Normal' },
  { tag: 'h1', label: 'Titre 1', short: 'Titre 1' },
  { tag: 'h2', label: 'Titre 2', short: 'Titre 2' },
  { tag: 'h3', label: 'Titre 3', short: 'Titre 3' },
  { tag: 'blockquote', label: 'Citation', short: 'Citation' },
];

const SPACINGS = [
  { value: '1.15', label: 'Simple (1,15)' },
  { value: '1.55', label: 'Standard (1,5)' },
  { value: '2', label: 'Double (2,0)' },
];

const TABLE_SIZES: [number, number][] = [
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
  [4, 4],
  [6, 4],
];

const SAVE_DELAY = 700;

export function WordEditorScreen({ route, navigation }: RootScreenProps<'WordEditor'>) {
  const { docId } = route.params;
  const { colors, dark } = useTheme();
  const { getDoc, readContent, writeContent, renameDoc, toggleFavorite, deleteDoc, markOpened } = useDocuments();
  const { toast, prompt, confirm } = useFeedback();
  const keyboardVisible = useKeyboardVisible();
  const accent = colors.modules.word;
  const doc = getDoc(docId);

  const bridge = useRef<BridgeHandle>(null);
  const latest = useRef<{ html: string; preview: string } | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageReady = useRef(false);
  const initialHtml = useRef<string | null>(null);
  const initialized = useRef(false);
  const leaving = useRef(false);
  const deleted = useRef(false);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<EditorState>(initialEditorState);
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const call = useCallback((method: string, ...args: unknown[]) => bridge.current?.run(editorCall(method, ...args)), []);

  const editorTheme = useMemo(
    () => ({
      bg: dark ? colors.surfaceLowest : colors.surfaceContainer,
      page: dark ? '#1E2027' : '#FFFFFF',
      text: dark ? '#E6E6EE' : '#1B1C22',
      muted: colors.outline,
      accent: accent.main,
      border: colors.outlineVariant,
      shadow: dark ? 'rgba(0,0,0,.35)' : 'rgba(27,31,59,.10)',
    }),
    [dark, colors, accent.main],
  );

  /* ---------------- Chargement ---------------- */

  const tryInit = useCallback(() => {
    if (initialized.current || !pageReady.current || initialHtml.current === null) return;
    initialized.current = true;
    call('init', { html: initialHtml.current, theme: editorTheme, autofocus: initialHtml.current === '' });
    const pendingText = takePendingInsert(docId);
    if (pendingText) call('insertHtml', ocrTextToHtml(pendingText));
    setLoading(false);
  }, [call, docId, editorTheme]);

  useEffect(() => {
    let alive = true;
    markOpened(docId);
    readContent(docId)
      .then((content) => {
        if (!alive) return;
        initialHtml.current = content ?? '';
        tryInit();
      })
      .catch(() => {
        if (!alive) return;
        initialHtml.current = '';
        tryInit();
        toast('Impossible de lire le document.');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    if (initialized.current) call('setTheme', editorTheme);
  }, [editorTheme, call]);

  /* ---------------- Enregistrement automatique ---------------- */

  const save = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirty.current || !latest.current || deleted.current) return;
    dirty.current = false;
    const { html, preview } = latest.current;
    try {
      await writeContent(docId, html, preview);
    } catch {
      dirty.current = true;
      toast("L'enregistrement a échoué.");
    }
    setSaving(dirty.current);
  }, [docId, writeContent, toast]);

  const saveRef = useRef(save);
  saveRef.current = save;

  // Dernier enregistrement à la fermeture de l'écran.
  useEffect(
    () => () => {
      saveRef.current();
    },
    [],
  );

  const onMessage = useCallback(
    (data: string) => {
      let message: EditorMessage;
      try {
        message = JSON.parse(data) as EditorMessage;
      } catch {
        return;
      }
      if (message.type === 'ready') {
        pageReady.current = true;
        tryInit();
      } else if (message.type === 'state') {
        setState(message.state);
      } else if (message.type === 'stats') {
        setStats({ words: message.words, chars: message.chars });
      } else if (message.type === 'change') {
        latest.current = { html: message.html, preview: message.preview };
        dirty.current = true;
        setStats({ words: message.words, chars: message.chars });
        setSaving(true);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveRef.current(), leaving.current ? 0 : SAVE_DELAY);
      }
    },
    [tryInit],
  );

  /* ---------------- Retour : on laisse la page envoyer ses dernières frappes ---------------- */

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    call('flush');
    setTimeout(() => navigation.goBack(), 120);
  }, [call, navigation]);

  useFocusEffect(
    useCallback(() => {
      // Texte reconnu par le scanner pendant que l'éditeur était en arrière-plan.
      if (initialized.current) {
        const pendingText = takePendingInsert(docId);
        if (pendingText) {
          call('insertHtml', ocrTextToHtml(pendingText));
          toast('Texte scanné inséré');
        }
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [call, docId, leave, toast]),
  );

  /* ---------------- Actions ---------------- */

  const rename = async () => {
    const title = await prompt({ title: 'Renommer le document', initialValue: doc?.title, placeholder: 'Nom du document', confirmLabel: 'Renommer' });
    if (title?.trim()) renameDoc(docId, title);
  };

  const insertImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      call('insertHtml', `<img src="data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}" alt=""><p><br></p>`);
    } catch {
      toast("Impossible d'insérer l'image.");
    }
  };

  const insertLink = async () => {
    const url = await prompt({ title: 'Insérer un lien', placeholder: 'https://exemple.fr', confirmLabel: 'Insérer', keyboardType: 'url' });
    if (!url?.trim()) return;
    const clean = url.trim();
    call('insertLink', /^(https?:\/\/|mailto:)/i.test(clean) ? clean : `https://${clean}`);
  };

  const remove = async () => {
    setSheet(null);
    const ok = await confirm({ title: 'Supprimer ce document ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', destructive: true });
    if (!ok) return;
    deleted.current = true;
    await deleteDoc(docId);
    navigation.goBack();
  };

  const pick = (action: () => void) => () => {
    setSheet(null);
    action();
  };

  const blockLabel = BLOCKS.find((b) => b.tag === state.block)?.short ?? 'Normal';

  const tabs: RibbonTab[] = [
    {
      key: 'home',
      label: 'Accueil',
      items: [
        { type: 'button', key: 'bold', icon: 'format-bold', label: 'Gras', active: state.bold, onPress: () => call('exec', 'bold') },
        { type: 'button', key: 'italic', icon: 'format-italic', label: 'Italique', active: state.italic, onPress: () => call('exec', 'italic') },
        { type: 'button', key: 'underline', icon: 'format-underline', label: 'Souligné', active: state.underline, onPress: () => call('exec', 'underline') },
        { type: 'button', key: 'strike', icon: 'format-strikethrough-variant', label: 'Barré', active: state.strike, onPress: () => call('exec', 'strikeThrough') },
        { type: 'divider', key: 'd1' },
        { type: 'button', key: 'color', icon: 'format-color-text', label: 'Couleur du texte', swatch: state.color ?? colors.onSurface, onPress: () => setSheet('color') },
        { type: 'button', key: 'highlight', icon: 'marker', label: 'Surlignage', swatch: highlight, onPress: () => setSheet('highlight') },
        { type: 'divider', key: 'd2' },
        { type: 'dropdown', key: 'size', text: String(state.fontSize).replace('.', ','), label: 'Taille de police', icon: 'format-size', onPress: () => setSheet('size') },
        { type: 'dropdown', key: 'style', text: blockLabel, label: 'Style de paragraphe', onPress: () => setSheet('style') },
        { type: 'dropdown', key: 'font', text: state.font === 'serif' ? 'Serif' : state.font === 'mono' ? 'Mono' : 'Sans', label: 'Police', icon: 'format-font', onPress: () => setSheet('font') },
        { type: 'divider', key: 'd3' },
        { type: 'button', key: 'clear', icon: 'format-clear', label: 'Effacer la mise en forme', onPress: () => call('clearFormat') },
      ],
    },
    {
      key: 'paragraph',
      label: 'Paragraphe',
      items: [
        { type: 'button', key: 'left', icon: 'format-align-left', label: 'Aligner à gauche', active: state.align === 'left', onPress: () => call('exec', 'justifyLeft') },
        { type: 'button', key: 'center', icon: 'format-align-center', label: 'Centrer', active: state.align === 'center', onPress: () => call('exec', 'justifyCenter') },
        { type: 'button', key: 'right', icon: 'format-align-right', label: 'Aligner à droite', active: state.align === 'right', onPress: () => call('exec', 'justifyRight') },
        { type: 'button', key: 'justify', icon: 'format-align-justify', label: 'Justifier', active: state.align === 'justify', onPress: () => call('exec', 'justifyFull') },
        { type: 'divider', key: 'd1' },
        { type: 'button', key: 'ul', icon: 'format-list-bulleted', label: 'Liste à puces', active: state.ul, onPress: () => call('exec', 'insertUnorderedList') },
        { type: 'button', key: 'ol', icon: 'format-list-numbered', label: 'Liste numérotée', active: state.ol, onPress: () => call('exec', 'insertOrderedList') },
        { type: 'divider', key: 'd2' },
        { type: 'button', key: 'outdent', icon: 'format-indent-decrease', label: 'Diminuer le retrait', onPress: () => call('exec', 'outdent') },
        { type: 'button', key: 'indent', icon: 'format-indent-increase', label: 'Augmenter le retrait', onPress: () => call('exec', 'indent') },
        { type: 'button', key: 'spacing', icon: 'format-line-spacing', label: 'Interligne', onPress: () => setSheet('spacing') },
        { type: 'button', key: 'quote', icon: 'format-quote-close', label: 'Citation', active: state.block === 'blockquote', onPress: () => call('setBlock', state.block === 'blockquote' ? 'p' : 'blockquote') },
      ],
    },
    {
      key: 'insert',
      label: 'Insertion',
      items: [
        { type: 'button', key: 'image', icon: 'image-plus-outline', label: 'Insérer une image', onPress: insertImage },
        { type: 'button', key: 'table', icon: 'table-plus', label: 'Insérer un tableau', onPress: () => setSheet('table') },
        { type: 'button', key: 'link', icon: 'link-variant-plus', label: 'Insérer un lien', onPress: insertLink },
        { type: 'button', key: 'hr', icon: 'minus', label: 'Ligne horizontale', onPress: () => call('insertRule') },
        { type: 'button', key: 'date', icon: 'calendar-today-outline', label: 'Insérer la date', onPress: () => call('insertText', formatShortDate()) },
        { type: 'divider', key: 'd1' },
        { type: 'button', key: 'scan', icon: 'line-scan', label: 'Scanner du texte (OCR)', onPress: () => navigation.navigate('Scanner', { insertInto: docId }) },
      ],
    },
  ];

  const subtitle = loading
    ? 'Ouverture…'
    : `${saving ? 'Enregistrement…' : 'Enregistré'} · ${stats.words} mot${stats.words > 1 ? 's' : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: editorTheme.bg }}>
      <AppBar
        title={doc?.title ?? 'Document'}
        subtitle={subtitle}
        onBack={leave}
        onTitlePress={rename}
        actions={
          <>
            <IconButton icon="undo" label="Annuler" disabled={!state.canUndo} onPress={() => call('exec', 'undo')} color={colors.onSurface} box={40} />
            <IconButton icon="redo" label="Rétablir" disabled={!state.canRedo} onPress={() => call('exec', 'redo')} color={colors.onSurface} box={40} />
            <IconButton icon="export-variant" label="Exporter" onPress={() => { call('flush'); setExportOpen(true); }} color={colors.onSurface} box={40} />
            <IconButton icon="dots-vertical" label="Plus d'options" onPress={() => setSheet('menu')} color={colors.onSurface} box={40} />
          </>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1 }}>
          <BridgeWebView ref={bridge} html={editorHtml} onMessage={onMessage} backgroundColor={editorTheme.bg} style={{ flex: 1 }} />
          {loading ? (
            <View style={[StyleSheet.absoluteFill, styles.loader, { backgroundColor: editorTheme.bg }]}>
              <ActivityIndicator color={accent.main} size="large" />
            </View>
          ) : null}
        </View>
        <Ribbon tabs={tabs} activeTab={tab} onTabChange={setTab} accent={accent} safeBottom={!keyboardVisible} />
      </KeyboardAvoidingView>

      <BottomSheet visible={sheet === 'size'} onClose={() => setSheet(null)} title="Taille de police">
        {FONT_SIZES.map((size) => (
          <ListItem key={size} title={`${size} pt`} selected={state.fontSize === size} onPress={pick(() => call('setFontSize', size))} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'style'} onClose={() => setSheet(null)} title="Style de paragraphe">
        {BLOCKS.map((block) => (
          <ListItem key={block.tag} title={block.label} selected={state.block === block.tag} onPress={pick(() => call('setBlock', block.tag))} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'font'} onClose={() => setSheet(null)} title="Police">
        {(Object.keys(FONT_FAMILIES) as EditorState['font'][]).map((key) => (
          <ListItem key={key} title={FONT_FAMILIES[key].label} selected={state.font === key} onPress={pick(() => call('exec', 'fontName', FONT_FAMILIES[key].css))} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'color'} onClose={() => setSheet(null)} title="Couleur du texte">
        <ColorPalette
          selected={state.color ?? undefined}
          noneLabel="Automatique"
          onSelect={(color) => pick(() => call('exec', 'foreColor', color ?? editorTheme.text))()}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'highlight'} onClose={() => setSheet(null)} title="Surlignage">
        <ColorPalette
          selected={highlight ?? undefined}
          noneLabel="Aucun surlignage"
          onSelect={(color) =>
            pick(() => {
              setHighlight(color);
              call('execCss', 'hiliteColor', color ?? 'transparent');
            })()
          }
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'spacing'} onClose={() => setSheet(null)} title="Interligne">
        {SPACINGS.map((spacing) => (
          <ListItem key={spacing.value} icon="format-line-spacing" title={spacing.label} onPress={pick(() => call('setLineHeight', spacing.value))} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'table'} onClose={() => setSheet(null)} title="Insérer un tableau">
        {TABLE_SIZES.map(([rows, cols]) => (
          <ListItem key={`${rows}x${cols}`} icon="table" title={`${rows} lignes × ${cols} colonnes`} onPress={pick(() => call('insertTable', rows, cols))} />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        title={doc?.title}
        subtitle={`${stats.words} mot${stats.words > 1 ? 's' : ''} · ${stats.chars} caractère${stats.chars > 1 ? 's' : ''}`}
      >
        <ListItem icon="pencil-outline" title="Renommer" onPress={pick(rename)} />
        <ListItem
          icon={doc?.favorite ? 'star-off-outline' : 'star-outline'}
          title={doc?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onPress={pick(() => toggleFavorite(docId))}
        />
        <ListItem icon="export-variant" title="Exporter / convertir" subtitle="PDF, HTML, TXT, Markdown, CSV" onPress={pick(() => { call('flush'); setExportOpen(true); })} />
        <ListItem icon="line-scan" title="Scanner du texte" subtitle="Insérer le texte d'une photo" onPress={pick(() => navigation.navigate('Scanner', { insertInto: docId }))} />
        <ListItem icon="trash-can-outline" title="Supprimer" destructive onPress={remove} />
      </BottomSheet>

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title={doc?.title}
        getSource={async () => ({
          title: doc?.title ?? 'Document',
          kind: 'text',
          content: latest.current?.html ?? initialHtml.current ?? '',
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { alignItems: 'center', justifyContent: 'center' },
});
