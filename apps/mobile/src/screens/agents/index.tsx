import { formatUsd } from '@402lab/shared';
import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { listAllowances, spentPercent, type Allowance } from '@/entities/allowance';
import { useConnection } from '@/entities/session';
import { AlertsPrompt, watchCaps } from '@/features/cap-alerts';
import { theme } from '@/shared/config/theme';
import { usePolling } from '@/shared/lib/use-polling';
import { Body, Header, Mono, Muted, OfflineState, Screen, StatusPill } from '@/shared/ui';
import { SpendRing } from '@/widgets/spend-ring';

import { styles } from './styles';

const FleetSummary = ({ allowances }: { allowances: Allowance[] }) => {
  const spentToday = allowances.reduce((sum, allowance) => sum + allowance.spentToday, 0n);
  const activeCount = allowances.filter((allowance) => allowance.status === 'active').length;

  return (
    <View style={styles.summary}>
      <View>
        <Muted style={styles.summaryLabel}>FLEET SPEND</Muted>
        <Mono style={styles.summaryValue}>{formatUsd(spentToday)}</Mono>
      </View>
      <View style={styles.summaryItem}>
        <Muted style={styles.summaryLabel}>ACTIVE</Muted>
        <Mono style={styles.summaryValue}>{`${String(activeCount)}/${String(allowances.length)}`}</Mono>
      </View>
    </View>
  );
};

const AgentCard = ({ allowance }: { allowance: Allowance }) => {
  const spent = `${String(spentPercent(allowance))}% · Spent today ${formatUsd(allowance.spentToday)} of ${formatUsd(allowance.dailyCap)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${allowance.agentName}, ${allowance.status}. ${spent}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => {
        router.push(`/agents/${allowance.id}`);
      }}
    >
      <SpendRing spent={allowance.spentToday} cap={allowance.dailyCap} size={56} label={false} />
      <View style={styles.cardBody}>
        <View style={styles.cardTitle}>
          <Body style={styles.name}>{allowance.agentName}</Body>
          <StatusPill status={allowance.status} />
        </View>
        <Muted>{spent}</Muted>
      </View>
      <Muted>›</Muted>
    </Pressable>
  );
};

export const AgentsScreen = () => {
  const { status, offline, run } = useConnection();
  const [allowances, setAllowances] = useState<Allowance[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      run(async (connection) => {
        const list = await listAllowances(connection);
        setAllowances(list);
        watchCaps(list);
      }),
    [run],
  );

  usePolling(load);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (status === 'unpaired') {
    return <Redirect href="/" />;
  }

  return (
    <Screen>
      <Header title="Your agents" />
      {allowances && allowances.length > 0 && <FleetSummary allowances={allowances} />}
      <AlertsPrompt />
      {offline && (
        <OfflineState
          onRetry={() => {
            void load();
          }}
        />
      )}
      <FlatList
        testID="agents-list"
        data={allowances ?? []}
        keyExtractor={(allowance) => allowance.id}
        renderItem={({ item }) => <AgentCard allowance={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.colors.lime}
          />
        }
        ListEmptyComponent={
          allowances ? (
            <Muted style={styles.empty}>
              No agents yet. Create an allowance on your dashboard.
            </Muted>
          ) : null
        }
      />
    </Screen>
  );
};
