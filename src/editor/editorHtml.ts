/**
 * Page de l'éditeur de texte enrichi, chargée dans une WebView.
 *
 * Protocole :
 *  - page → application (postMessage JSON) : `ready`, `state` (mise en forme à la sélection), `change` (contenu) ;
 *  - application → page : appels des méthodes de `window.Editor` (voir editorCommands.ts).
 */
export const editorHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root {
    --bg: #eef0f8; --page: #ffffff; --text: #1b1c22; --muted: #8a8c98; --accent: #2a63d6; --border: #c6c7d2; --shadow: rgba(27,31,59,.10);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; min-height: 100%; background: var(--bg); }
  body { padding: 12px 10px 28px; }
  #page {
    min-height: calc(100vh - 40px);
    max-width: 820px; margin: 0 auto;
    padding: 28px 22px 96px;
    background: var(--page); color: var(--text);
    border-radius: 14px; box-shadow: 0 1px 3px var(--shadow), 0 6px 18px var(--shadow);
    outline: none;
    font-family: Roboto, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 12pt; line-height: 1.55;
    word-wrap: break-word; overflow-wrap: anywhere;
    caret-color: var(--accent);
    -webkit-user-select: text; user-select: text;
  }
  #page.empty::before { content: attr(data-placeholder); color: var(--muted); position: absolute; pointer-events: none; }
  #page ::selection { background: color-mix(in srgb, var(--accent) 30%, transparent); }
  #page h1 { font-size: 24pt; line-height: 1.2; margin: .5em 0 .35em; font-weight: 700; }
  #page h2 { font-size: 18pt; line-height: 1.25; margin: .7em 0 .35em; font-weight: 700; }
  #page h3 { font-size: 14pt; line-height: 1.3; margin: .8em 0 .35em; font-weight: 600; }
  #page p, #page div { margin: 0 0 .5em; }
  #page ul, #page ol { margin: 0 0 .6em; padding-left: 1.6em; }
  #page li { margin: .15em 0; }
  #page blockquote { margin: .7em 0; padding: .2em 1em; border-left: 3px solid var(--accent); color: var(--muted); }
  #page a { color: var(--accent); }
  #page img { max-width: 100%; height: auto; border-radius: 6px; }
  #page hr { border: none; border-top: 1px solid var(--border); margin: 1.1em 0; }
  #page table { border-collapse: collapse; width: 100%; margin: .7em 0; table-layout: fixed; }
  #page td, #page th { border: 1px solid var(--border); padding: 6px 8px; vertical-align: top; min-width: 36px; }
  #page th { font-weight: 600; background: color-mix(in srgb, var(--accent) 10%, transparent); }
  #page code { font-family: 'Roboto Mono', Menlo, Consolas, monospace; font-size: .92em; background: color-mix(in srgb, var(--muted) 18%, transparent); padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<div id="page" contenteditable="true" spellcheck="true" data-placeholder="Commencez à écrire…" role="textbox" aria-multiline="true" aria-label="Contenu du document"></div>
<script>
(function () {
  var page = document.getElementById('page');
  var savedRange = null;
  var pendingFontSize = null;
  var changeTimer = null;
  var stateTimer = null;
  var lastHtml = null;

  function send(message) {
    var data = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(data);
    else if (window.parent && window.parent !== window) window.parent.postMessage(data, '*');
  }

  function isInside(node) {
    return !!node && (node === page || page.contains(node));
  }

  function saveSelection() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && isInside(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    page.focus({ preventScroll: true });
    var sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0 && isInside(sel.anchorNode)) return;
    sel.removeAllRanges();
    if (savedRange) {
      sel.addRange(savedRange);
    } else {
      var range = document.createRange();
      range.selectNodeContents(page);
      range.collapse(false);
      sel.addRange(range);
    }
  }

  function updateEmpty() {
    var empty = page.textContent.trim() === '' && !page.querySelector('img,table,hr,li');
    page.classList.toggle('empty', empty);
  }

  function applyPendingFontSize() {
    if (pendingFontSize === null) return;
    var fonts = page.querySelectorAll('font[size="7"]');
    for (var i = 0; i < fonts.length; i++) {
      // On remplace <font size> par un <span> stylé, en conservant couleur et police déjà posées.
      var span = document.createElement('span');
      span.style.cssText = fonts[i].style.cssText;
      if (fonts[i].getAttribute('color')) span.style.color = fonts[i].getAttribute('color');
      if (fonts[i].getAttribute('face')) span.style.fontFamily = fonts[i].getAttribute('face');
      span.style.fontSize = pendingFontSize + 'pt';
      while (fonts[i].firstChild) span.appendChild(fonts[i].firstChild);
      // Les tailles imbriquées plus anciennes masqueraient la nouvelle.
      var inner = span.querySelectorAll('[style*="font-size"]');
      for (var j = 0; j < inner.length; j++) inner[j].style.fontSize = '';
      fonts[i].parentNode.replaceChild(span, fonts[i]);
    }
    if (fonts.length > 0) pendingFontSize = null;
  }

  /** Corrige les imbrications invalides produites par le navigateur (liste ou tableau dans un paragraphe). */
  function normalize() {
    var wrapped = page.querySelectorAll('p > ul, p > ol, p > table, p > hr, p > blockquote, p > h1, p > h2, p > h3');
    for (var i = 0; i < wrapped.length; i++) {
      var parent = wrapped[i].parentNode;
      if (!parent || parent.nodeName !== 'P' || parent === page) continue;
      var onlyChild = parent.childNodes.length === 1;
      parent.parentNode.insertBefore(wrapped[i], onlyChild ? parent : parent.nextSibling);
      if (onlyChild) parent.remove();
    }
  }

  /** Bloc de premier niveau (enfant direct de la page) contenant la sélection. */
  function topBlock() {
    var sel = window.getSelection();
    var node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).endContainer : null;
    if (!isInside(node) || node === page) return null;
    while (node.parentNode !== page) node = node.parentNode;
    return node;
  }

  function placeCaret(node, atStart) {
    var range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(!!atStart);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    saveSelection();
  }

  /** Insère un élément de bloc après le bloc courant (ou à sa place s'il est vide), suivi d'un paragraphe. */
  function insertBlock(element, caretTarget) {
    restoreSelection();
    var current = topBlock();
    var after = document.createElement('p');
    after.appendChild(document.createElement('br'));
    if (!current) {
      page.appendChild(element);
    } else if (current.nodeName === 'P' && current.textContent.trim() === '' && !current.querySelector('img')) {
      page.replaceChild(element, current);
    } else {
      page.insertBefore(element, current.nextSibling);
    }
    page.insertBefore(after, element.nextSibling);
    placeCaret(caretTarget || after, true);
    afterEdit();
  }

  function blockOf(node) {
    while (node && node !== page) {
      if (node.nodeType === 1 && /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|TD|TH)$/.test(node.nodeName)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function selectedBlocks() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    var range = sel.getRangeAt(0);
    var blocks = [];
    var start = blockOf(range.startContainer);
    if (range.collapsed) return start ? [start] : [];
    var nodes = page.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote');
    for (var i = 0; i < nodes.length; i++) if (range.intersectsNode(nodes[i])) blocks.push(nodes[i]);
    if (blocks.length === 0 && start) blocks.push(start);
    return blocks;
  }

  function query(command) {
    try { return document.queryCommandState(command); } catch (e) { return false; }
  }

  function rgbToHex(value) {
    var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(value || '');
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }).join('').toUpperCase();
  }

  function currentState() {
    var sel = window.getSelection();
    var node = null;
    if (sel && sel.rangeCount > 0) {
      // On lit la mise en forme du premier caractère sélectionné (et non celle du bloc englobant).
      var range = sel.getRangeAt(0);
      node = range.startContainer;
      if (node.nodeType === 1 && node.childNodes[range.startOffset]) node = node.childNodes[range.startOffset];
      else if (node.nodeType === 3 && !range.collapsed && range.startOffset === node.length && node.nextSibling) node = node.nextSibling;
      while (node.nodeType === 1 && node.firstChild && node.nodeName !== 'TABLE') node = node.firstChild;
    }
    var element = node && node.nodeType === 3 ? node.parentNode : node;
    if (!isInside(element)) element = page;
    var computed = window.getComputedStyle(element);
    var block = blockOf(element);
    var blockName = block ? block.nodeName.toLowerCase() : 'p';
    var align = 'left';
    if (query('justifyCenter')) align = 'center';
    else if (query('justifyRight')) align = 'right';
    else if (query('justifyFull')) align = 'justify';
    var family = (computed.fontFamily || '').toLowerCase();
    return {
      bold: query('bold'),
      italic: query('italic'),
      underline: query('underline'),
      strike: query('strikeThrough'),
      ul: query('insertUnorderedList'),
      ol: query('insertOrderedList'),
      align: align,
      block: /^h[1-3]$/.test(blockName) || blockName === 'blockquote' ? blockName : 'p',
      fontSize: Math.round(parseFloat(computed.fontSize) * 0.75 * 2) / 2,
      font: family.indexOf('mono') >= 0 || family.indexOf('courier') >= 0 ? 'mono' : /georgia|times|(^|[^-])serif/.test(family.replace(/sans-serif/g, '')) ? 'serif' : 'sans',
      color: rgbToHex(computed.color),
      canUndo: (function () { try { return document.queryCommandEnabled('undo'); } catch (e) { return false; } })(),
      canRedo: (function () { try { return document.queryCommandEnabled('redo'); } catch (e) { return false; } })(),
    };
  }

  function emitState() {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(function () { send({ type: 'state', state: currentState() }); }, 60);
  }

  function emitChange(immediate) {
    clearTimeout(changeTimer);
    var run = function () {
      var html = page.innerHTML;
      if (html === lastHtml) return;
      lastHtml = html;
      var text = page.innerText || '';
      var words = text.trim() ? text.trim().split(/\\s+/).length : 0;
      send({ type: 'change', html: html, preview: text.replace(/\\s+/g, ' ').trim().slice(0, 160), words: words, chars: text.replace(/\\n/g, '').length });
    };
    if (immediate) run(); else changeTimer = setTimeout(run, 350);
  }

  function afterEdit() {
    applyPendingFontSize();
    normalize();
    updateEmpty();
    emitChange(false);
    emitState();
  }

  function exec(command, value) {
    restoreSelection();
    document.execCommand(command, false, value === undefined ? null : value);
    saveSelection();
    afterEdit();
  }

  page.addEventListener('input', afterEdit);
  page.addEventListener('focus', emitState);
  page.addEventListener('blur', function () { emitChange(true); });
  document.addEventListener('selectionchange', function () {
    saveSelection();
    emitState();
  });
  // Coller en texte enrichi « propre » : on retire styles de page, scripts et attributs d'événements.
  page.addEventListener('paste', function (event) {
    var data = event.clipboardData;
    if (!data) return;
    var html = data.getData('text/html');
    if (!html) return;
    event.preventDefault();
    var box = document.createElement('div');
    box.innerHTML = html;
    var junk = box.querySelectorAll('script,style,meta,link,iframe,object,embed');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var all = box.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var attrs = all[j].attributes;
      for (var k = attrs.length - 1; k >= 0; k--) {
        var name = attrs[k].name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'class' || name === 'id') all[j].removeAttribute(attrs[k].name);
      }
    }
    document.execCommand('insertHTML', false, box.innerHTML);
  });

  window.Editor = {
    init: function (options) {
      window.Editor.setTheme(options.theme);
      page.innerHTML = options.html || '';
      lastHtml = page.innerHTML;
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
        document.execCommand('styleWithCSS', false, false);
      } catch (e) {}
      updateEmpty();
      emitState();
      var text = page.innerText || '';
      send({ type: 'stats', words: text.trim() ? text.trim().split(/\\s+/).length : 0, chars: text.replace(/\\n/g, '').length });
      if (options.autofocus) setTimeout(function () { page.focus(); }, 150);
    },
    setTheme: function (theme) {
      if (!theme) return;
      var root = document.documentElement.style;
      for (var key in theme) root.setProperty('--' + key, theme[key]);
    },
    exec: exec,
    /** Commandes nécessitant le mode CSS (surlignage). */
    execCss: function (command, value) {
      restoreSelection();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(command, false, value);
      document.execCommand('styleWithCSS', false, false);
      saveSelection();
      afterEdit();
    },
    setBlock: function (tag) {
      exec('formatBlock', '<' + tag + '>');
    },
    setFontSize: function (points) {
      restoreSelection();
      pendingFontSize = points;
      document.execCommand('fontSize', false, '7');
      saveSelection();
      afterEdit();
    },
    setLineHeight: function (value) {
      restoreSelection();
      var blocks = selectedBlocks();
      if (blocks.length === 0) {
        document.execCommand('formatBlock', false, '<p>');
        blocks = selectedBlocks();
      }
      for (var i = 0; i < blocks.length; i++) blocks[i].style.lineHeight = value;
      afterEdit();
    },
    insertHtml: function (html) {
      exec('insertHTML', html);
    },
    insertText: function (text) {
      exec('insertText', text);
    },
    insertLink: function (url, label) {
      restoreSelection();
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        document.execCommand('createLink', false, url);
      } else {
        var a = document.createElement('a');
        a.href = url;
        a.textContent = label || url;
        document.execCommand('insertHTML', false, a.outerHTML + '&nbsp;');
      }
      saveSelection();
      afterEdit();
    },
    insertTable: function (rows, cols) {
      var table = document.createElement('table');
      var body = document.createElement('tbody');
      for (var r = 0; r < rows; r++) {
        var row = document.createElement('tr');
        for (var c = 0; c < cols; c++) {
          var cell = document.createElement(r === 0 ? 'th' : 'td');
          cell.appendChild(document.createElement('br'));
          row.appendChild(cell);
        }
        body.appendChild(row);
      }
      table.appendChild(body);
      insertBlock(table, body.rows[0].cells[0]);
    },
    insertRule: function () {
      insertBlock(document.createElement('hr'));
    },
    clearFormat: function () {
      restoreSelection();
      document.execCommand('removeFormat', false, null);
      document.execCommand('formatBlock', false, '<p>');
      var blocks = selectedBlocks();
      for (var i = 0; i < blocks.length; i++) blocks[i].removeAttribute('style');
      saveSelection();
      afterEdit();
    },
    focus: function () { restoreSelection(); },
    blur: function () { page.blur(); },
    /** Demande l'envoi immédiat du contenu (avant de quitter l'écran). */
    flush: function () { emitChange(true); },
  };

  send({ type: 'ready' });
})();
</script>
</body>
</html>`;

export interface EditorState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  block: 'p' | 'h1' | 'h2' | 'h3' | 'blockquote';
  fontSize: number;
  font: 'sans' | 'serif' | 'mono';
  color: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export const initialEditorState: EditorState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  ul: false,
  ol: false,
  align: 'left',
  block: 'p',
  fontSize: 12,
  font: 'sans',
  color: null,
  canUndo: false,
  canRedo: false,
};

export type EditorMessage =
  | { type: 'ready' }
  | { type: 'state'; state: EditorState }
  | { type: 'stats'; words: number; chars: number }
  | { type: 'change'; html: string; preview: string; words: number; chars: number };

/** Sérialise un appel `Editor.methode(...args)` à injecter dans la page. */
export function editorCall(method: string, ...args: unknown[]): string {
  // U+2028 et U+2029 sont des fins de ligne en JavaScript : on les échappe pour ne pas casser le script injecté.
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const serialized = args.map((a) => JSON.stringify(a).split(LS).join('\\u2028').split(PS).join('\\u2029')).join(',');
  return `window.Editor && window.Editor.${method}(${serialized});`;
}

export const FONT_FAMILIES: Record<EditorState['font'], { label: string; css: string }> = {
  sans: { label: 'Sans empattement', css: 'Roboto, Arial, sans-serif' },
  serif: { label: 'Avec empattement', css: 'Georgia, "Times New Roman", serif' },
  mono: { label: 'Chasse fixe', css: '"Roboto Mono", "Courier New", monospace' },
};

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
