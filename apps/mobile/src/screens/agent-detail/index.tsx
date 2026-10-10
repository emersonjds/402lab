import { formatUsd } from '@402lab/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { listAllowances, type Allowance } from '@/entities/allowance';
import { listPayments, mergeNewestFirst, serviceName, type Payment } from '@/entities/payment';
import { useConnection } from '@/entities/session';
import { theme } from '@/shared/config/theme';
import { timeAgo } from '@/shared/lib/time-ago';
import { usePolling } from '@/shared/lib/use-polling';
import { Body, DevnetBadge, Mono, Muted, OfflineState, Screen, Title } from '@/shared/ui';
import { PaymentSheet } from '@/widgets/payment-sheet';
import { SpendRing } from '@/widgets/spend-ring';

import { styles } from './styles';

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
  const { status, offline, run } = useConnection();
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cursor = useRef<string | undefined>(undefined);

  const poll = useCallback(
    () =>
      run(async (connection) => {
        const [allowances, page] = await Promise.all([
          listAllowances(connection),
          listPayments(connection, id, cursor.current),
        ]);
        setAllowance(allowances.find((candidate) => candidate.id === id) ?? null);
        cursor.current = page.at(-1)?.id ?? cursor.current;
        setPayments((current) => mergeNewestFirst(current, page));
      }),
    [run, id],
  );

  usePolling(poll);

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
      {offline && (
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
              <SpendRing spent={allowance.spentToday} cap={allowance.dailyCap} />
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
