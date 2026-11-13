import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CellValue, colToLetters, isErrorCode, parseKey } from '../../services/spreadsheet/formula';
import { Bounds, colOffsets, formatValue, Selection, selectionBounds } from '../../services/spreadsheet/sheetModel';
import { useTheme } from '../../theme/ThemeProvider';
import type { ModuleColors } from '../../theme/tokens';
import type { CellStyle, SheetContent } from '../../types';
import { Icon } from '../ui/Icon';

export const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 30;
const ROW_HEADER_WIDTH = 46;
const ADD_SIZE = 56;

interface RowCell {
  col: number;
  text: string;
  style?: CellStyle;
  numeric: boolean;
  error: boolean;
}

interface Props {
  sheet: SheetContent;
  values: Record<string, CellValue>;
  selection: Selection;
  accent: ModuleColors;
  onCellPress(row: number, col: number): void;
  onCellLongPress(row: number, col: number): void;
  onAddRows(): void;
  onAddCols(): void;
}

export interface GridHandle {
  /** Fait défiler la grille pour rendre une cellule visible. */
  reveal(row: number, col: number): void;
}

const readableOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150 ? '#1B1C22' : '#FFFFFF';
};

/** Ligne de la grille : ne rend que les cellules renseignées. */
const GridRow = React.memo(
  function GridRow({ cells, offsets, textColor, errorColor }: { cells: RowCell[]; signature: string; offsets: number[]; textColor: string; errorColor: string }) {
    return (
      <>
        {cells.map((cell) => {
          const s = cell.style;
          const color = cell.error ? errorColor : (s?.color ?? (s?.bg ? readableOn(s.bg) : textColor));
          return (
            <View
              key={cell.col}
              style={[styles.cell, { left: offsets[cell.col], width: offsets[cell.col + 1] - offsets[cell.col] - 1, backgroundColor: s?.bg }]}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 14,
                  color,
                  textAlign: s?.align ?? (cell.numeric ? 'right' : cell.error ? 'center' : 'left'),
                  fontWeight: s?.bold ? '700' : '400',
                  fontStyle: s?.italic ? 'italic' : 'normal',
                  textDecorationLine: s?.underline ? 'underline' : 'none',
                }}
              >
                {cell.text}
              </Text>
            </View>
          );
        })}
      </>
    );
  },
  (prev, next) => prev.signature === next.signature && prev.offsets === next.offsets && prev.textColor === next.textColor,
);

export const Grid = forwardRef<GridHandle, Props>(function Grid(
  { sheet, values, selection, accent, onCellPress, onCellLongPress, onAddRows, onAddCols },
  ref,
) {
  const { colors } = useTheme();
  const vertical = useRef<ScrollViewInstance>(null);
  const horizontal = useRef<ScrollViewInstance>(null);
  const header = useRef<ScrollViewInstance>(null);
  const scroll = useRef({ x: 0, y: 0 });
  const viewport = useRef({ width: 0, height: 0 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const offsets = useMemo(() => colOffsets(sheet), [sheet.cols, sheet.colWidths]);
  const totalWidth = offsets[sheet.cols];
  const totalHeight = sheet.rows * ROW_HEIGHT;
  const bounds: Bounds = selectionBounds(selection);

  /** Cellules renseignées, regroupées par ligne. */
  const rowsData = useMemo(() => {
    const map = new Map<number, { cells: RowCell[]; signature: string }>();
    for (const key of Object.keys(sheet.cells)) {
      const pos = parseKey(key);
      if (!pos || pos.row >= sheet.rows || pos.col >= sheet.cols) continue;
      const cell = sheet.cells[key];
      const value = values[key] ?? null;
      const entry = map.get(pos.row) ?? { cells: [], signature: '' };
      entry.cells.push({
        col: pos.col,
        text: formatValue(value, cell.s?.format),
        style: cell.s,
        numeric: typeof value === 'number',
        error: isErrorCode(value),
      });
      map.set(pos.row, entry);
    }
    for (const entry of map.values()) entry.signature = JSON.stringify(entry.cells);
    return map;
  }, [sheet.cells, sheet.rows, sheet.cols, values]);

  const locate = useCallback(
    (event: GestureResponderEvent): { row: number; col: number } | null => {
      // Sur le web, un clic souris fournit offsetX/offsetY au lieu de locationX/locationY.
      const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & { offsetX?: number; offsetY?: number };
      const locationX = native.locationX ?? native.offsetX;
      const locationY = native.locationY ?? native.offsetY;
      if (typeof locationX !== 'number' || typeof locationY !== 'number' || Number.isNaN(locationX) || Number.isNaN(locationY)) return null;
      const row = Math.floor(locationY / ROW_HEIGHT);
      if (row < 0 || row >= sheet.rows || locationX < 0 || locationX >= totalWidth) return null;
      let col = 0;
      while (col < sheet.cols - 1 && offsets[col + 1] <= locationX) col++;
      return { row, col };
    },
    [offsets, sheet.rows, sheet.cols, totalWidth],
  );

  const reveal = useCallback(
    (row: number, col: number) => {
      const { width, height } = viewport.current;
      if (!width || !height) return;
      const visibleWidth = width - ROW_HEADER_WIDTH;
      const visibleHeight = height - HEADER_HEIGHT;
      const left = offsets[col];
      const right = offsets[col + 1];
      const top = row * ROW_HEIGHT;
      const bottom = top + ROW_HEIGHT;
      let { x, y } = scroll.current;
      if (left < x) x = left;
      else if (right > x + visibleWidth) x = right - visibleWidth;
      if (top < y) y = top;
      else if (bottom > y + visibleHeight) y = bottom - visibleHeight;
      if (x !== scroll.current.x) horizontal.current?.scrollTo({ x, animated: true });
      if (y !== scroll.current.y) vertical.current?.scrollTo({ y, animated: true });
    },
    [offsets],
  );

  useImperativeHandle(ref, () => ({ reveal }), [reveal]);

  // La cellule active reste visible quand la sélection se déplace (touche Entrée, par exemple).
  useEffect(() => {
    reveal(selection.endRow, selection.endCol);
  }, [selection.endRow, selection.endCol, reveal]);

  const onHorizontalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    scroll.current.x = x;
    header.current?.scrollTo({ x, animated: false });
  };

  const columnHeaders = useMemo(
    () =>
      Array.from({ length: sheet.cols }, (_, col) => {
        const selected = col >= bounds.c1 && col <= bounds.c2;
        return (
          <View
            key={col}
            style={[
              styles.colHeader,
              { width: offsets[col + 1] - offsets[col], borderRightColor: colors.outlineVariant, backgroundColor: selected ? accent.container : undefined },
            ]}
          >
            <Text style={[styles.headerText, { color: selected ? accent.onContainer : colors.onSurfaceVariant, fontWeight: selected ? '700' : '500' }]}>
              {colToLetters(col)}
            </Text>
          </View>
        );
      }),
    [sheet.cols, offsets, bounds.c1, bounds.c2, colors, accent],
  );

  const rowHeaders = useMemo(
    () =>
      Array.from({ length: sheet.rows }, (_, row) => {
        const selected = row >= bounds.r1 && row <= bounds.r2;
        return (
          <View
            key={row}
            style={[styles.rowHeader, { borderBottomColor: colors.outlineVariant, backgroundColor: selected ? accent.container : undefined }]}
          >
            <Text style={[styles.headerText, { color: selected ? accent.onContainer : colors.onSurfaceVariant, fontWeight: selected ? '700' : '500' }]}>
              {row + 1}
            </Text>
          </View>
        );
      }),
    [sheet.rows, bounds.r1, bounds.r2, colors, accent],
  );

  const gridLines = useMemo(
    () => (
      <>
        {Array.from({ length: sheet.rows }, (_, row) => (
          <View key={`h${row}`} style={[styles.hLine, { top: (row + 1) * ROW_HEIGHT - 1, width: totalWidth, backgroundColor: colors.outlineVariant }]} />
        ))}
        {Array.from({ length: sheet.cols }, (_, col) => (
          <View key={`v${col}`} style={[styles.vLine, { left: offsets[col + 1] - 1, height: totalHeight, backgroundColor: colors.outlineVariant }]} />
        ))}
      </>
    ),
    [sheet.rows, sheet.cols, offsets, totalWidth, totalHeight, colors.outlineVariant],
  );

  const multi = bounds.r1 !== bounds.r2 || bounds.c1 !== bounds.c2;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.surfaceLowest }}
      onLayout={(event: LayoutChangeEvent) => {
        viewport.current = event.nativeEvent.layout;
      }}
    >
      <ScrollView
        ref={vertical}
        stickyHeaderIndices={[0]}
        scrollEventThrottle={32}
        onScroll={(event) => {
          scroll.current.y = event.nativeEvent.contentOffset.y;
        }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator
      >
        <View style={[styles.headerRow, { backgroundColor: colors.surfaceContainer, borderBottomColor: colors.outlineVariant }]}>
          <View style={[styles.corner, { borderRightColor: colors.outlineVariant }]} />
          <ScrollView ref={header} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
            {columnHeaders}
            <View style={{ width: ADD_SIZE }} />
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: ROW_HEADER_WIDTH, backgroundColor: colors.surfaceContainer, borderRightWidth: 1, borderRightColor: colors.outlineVariant }}>
            {rowHeaders}
          </View>
          <ScrollView
            ref={horizontal}
            horizontal
            onScroll={onHorizontalScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityLabel="Grille de cellules"
              onPress={(event) => {
                const cell = locate(event);
                if (cell) onCellPress(cell.row, cell.col);
              }}
              onLongPress={(event) => {
                const cell = locate(event);
                if (cell) onCellLongPress(cell.row, cell.col);
              }}
              delayLongPress={350}
              style={{ width: totalWidth, height: totalHeight }}
            >
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {gridLines}
                {[...rowsData.entries()].map(([row, entry]) => (
                  <View key={row} style={[styles.row, { top: row * ROW_HEIGHT, width: totalWidth }]}>
                    <GridRow cells={entry.cells} signature={entry.signature} offsets={offsets} textColor={colors.onSurface} errorColor={colors.error} />
                  </View>
                ))}
                {multi ? (
                  <View
                    style={[
                      styles.range,
                      {
                        left: offsets[bounds.c1],
                        top: bounds.r1 * ROW_HEIGHT,
                        width: offsets[bounds.c2 + 1] - offsets[bounds.c1],
                        height: (bounds.r2 - bounds.r1 + 1) * ROW_HEIGHT,
                        borderColor: accent.main,
                        backgroundColor: accent.main + '22',
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.active,
                    {
                      left: offsets[selection.col] - 1,
                      top: selection.row * ROW_HEIGHT - 1,
                      width: offsets[selection.col + 1] - offsets[selection.col] + 1,
                      height: ROW_HEIGHT + 1,
                      borderColor: accent.main,
                    },
                  ]}
                />
              </View>
            </Pressable>
            <Pressable
              onPress={onAddCols}
              accessibilityRole="button"
              accessibilityLabel="Ajouter des colonnes"
              style={[styles.addCol, { height: totalHeight, backgroundColor: colors.surfaceLow }]}
            >
              <Icon name="plus" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          </ScrollView>
        </View>

        <Pressable
          onPress={onAddRows}
          accessibilityRole="button"
          accessibilityLabel="Ajouter des lignes"
          style={[styles.addRow, { backgroundColor: colors.surfaceLow }]}
        >
          <Icon name="plus" size={20} color={colors.onSurfaceVariant} />
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' }}>Ajouter 20 lignes</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', height: HEADER_HEIGHT, borderBottomWidth: 1 },
  corner: { width: ROW_HEADER_WIDTH, borderRightWidth: 1 },
  colHeader: { height: HEADER_HEIGHT - 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  rowHeader: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  headerText: { fontSize: 12 },
  hLine: { position: 'absolute', left: 0, height: 1 },
  vLine: { position: 'absolute', top: 0, width: 1 },
  row: { position: 'absolute', left: 0, height: ROW_HEIGHT - 1 },
  cell: { position: 'absolute', top: 0, height: ROW_HEIGHT - 1, justifyContent: 'center', paddingHorizontal: 6, overflow: 'hidden' },
  range: { position: 'absolute', borderWidth: 1 },
  active: { position: 'absolute', borderWidth: 2, borderRadius: 2 },
  addCol: { width: ADD_SIZE, alignItems: 'center', paddingTop: 8 },
  addRow: { height: ADD_SIZE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
