import { Text, View, StyleSheet } from 'react-native';
import type { MonitorStatus } from '@upkeep/core';
import { useTheme } from './ThemeProvider';

const LABELS: Record<MonitorStatus, string> = {
  UP: 'Up',
  DOWN: 'Down',
  PAUSED: 'Paused',
  PENDING: 'Pending',
};

export function StatusChip({ status }: { status: MonitorStatus }) {
  const { theme } = useTheme();
  const colors = {
    UP: { fg: theme.statusUp, bg: theme.statusUpSoft },
    DOWN: { fg: theme.statusDown, bg: theme.statusDownSoft },
    PAUSED: { fg: theme.statusPaused, bg: theme.statusPausedSoft },
    PENDING: { fg: theme.statusPending, bg: theme.statusPendingSoft },
  }[status];
  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.fg }]} />
      <Text style={[styles.text, { color: colors.fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
