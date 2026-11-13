import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

interface Props {
  icon: IconName;
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceContainer }]}>
        <Icon name={icon} size={34} color={colors.onSurfaceVariant} />
      </View>
      <Txt variant="title" center>
        {title}
      </Txt>
      <Txt variant="bodySmall" muted center style={{ maxWidth: 280 }}>
        {message}
      </Txt>
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 6 },
  badge: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
