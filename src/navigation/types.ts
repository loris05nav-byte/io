import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Files: { filter?: 'all' | 'text' | 'sheet' | 'favorite' } | undefined;
  Convert: { docId?: string } | undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  WordEditor: { docId: string };
  SheetEditor: { docId: string };
  /** `insertInto` : identifiant du document texte dans lequel insérer le texte reconnu. */
  Scanner: { insertInto?: string } | undefined;
  Settings: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
