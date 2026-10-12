import { formatUsd } from '@402lab/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { useAllowances } from '@/entities/allowance';
import { serviceName, usePayments, type Payment } from '@/entities/payment';
import { useConnection } from '@/entities/session';
import { notifyPausedFromPhone, useCapAlerts } from '@/features/cap-alerts';
import { PauseControl } from '@/features/pause-agent';
import { theme } from '@/shared/config/theme';
import { resetsInLabel, timeAgo } from '@/shared/lib/time-ago';
import { Body, DevnetBadge, Mono, Muted, OfflineState, Screen, Title } from '@/shared/ui';
import { PaymentSheet } from '@/widgets/payment-sheet';
import { SpendRing } from '@/widgets/spend-ring';

import { styles } from './styles';

const startOfUtcDayMs = (): number => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.getTime();
};

const FeedRow = ({ payment, onPress }: { payment: Payment; onPress: () => void }) => {
  const name = serviceName(payment.serviceId);
  const amount = formatUsd(payment.amount);
  const ago = timeAgo(payment.settledAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${amount}, ${ago}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.rowBody}>
        <Body>{name}</Body>
        <Muted>{ago}</Muted>
      </View>
      <Mono>{amount}</Mono>
      <Muted>›</Muted>
    </Pressable>
  );
};

export const AgentDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, connection } = useConnection();
  const allowancesQuery = useAllowances(connection);
  const paymentsQuery = usePayments(connection, id);
  const allowance = allowancesQuery.data?.find((candidate) => candidate.id === id) ?? null;
  const payments = paymentsQuery.data ?? [];
  const [selected, setSelected] = useState<Payment | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useCapAlerts(allowancesQuery.data);

  const poll = () => Promise.all([allowancesQuery.refetch(), paymentsQuery.refetch()]);

  const refresh = async () => {
    setRefreshing(true);
    await poll();
    setRefreshing(false);
  };

  if (status === 'unpaired') {
    return <Redirect href="/" />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to your agents"
          style={styles.back}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Title style={styles.title} numberOfLines={1}>
          {allowance?.agentName ?? ''}
        </Title>
        <DevnetBadge />
      </View>
      {(allowancesQuery.isError || paymentsQuery.isError) && (
        <OfflineState
          onRetry={() => {
            void poll();
          }}
        />
      )}
      <FlatList
        testID="payment-feed"
        data={payments}
        keyExtractor={(payment) => payment.id}
        renderItem={({ item }) => (
          <FeedRow
            payment={item}
            onPress={() => {
              setSelected(item);
            }}
          />
        )}
        ListHeaderComponent={
          allowance ? (
            <View style={styles.hero}>
              <Muted style={styles.caption}>TODAY&apos;S ALLOWANCE</Muted>
              <SpendRing spent={allowance.spentToday} cap={allowance.dailyCap} />
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Muted style={styles.caption}>RESETS IN</Muted>
                  <Mono>{resetsInLabel()}</Mono>
                </View>
                <View style={styles.statItem}>
                  <Muted style={styles.caption}>CALLS TODAY</Muted>
                  <Mono>
                    {String(
                      payments.filter((payment) => Date.parse(payment.settledAt) >= startOfUtcDayMs())
                        .length,
                    )}
                  </Mono>
                </View>
              </View>
              <PauseControl
                allowance={allowance}
                onUpdated={(updated) => {
                  if (updated.status === 'paused') {
                    notifyPausedFromPhone(updated.agentName);
                  }
                }}
              />
              <Muted style={styles.feedLabel}>LIVE PAYMENT STREAM</Muted>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.colors.lime}
          />
        }
        contentContainerStyle={styles.list}
      />
      <PaymentSheet
        payment={selected}
        onClose={() => {
          setSelected(null);
        }}
      />
    </Screen>
  );
};
