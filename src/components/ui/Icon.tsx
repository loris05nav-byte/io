import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const Icon = MaterialCommunityIcons;
