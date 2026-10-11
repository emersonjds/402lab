import { useState } from 'react';
import { View } from 'react-native';

import { setAllowanceStatus, type Allowance, type AllowanceStatus } from '@/entities/allowance';
import { useConnection } from '@/entities/session';
import { Body, Button, Muted } from '@/shared/ui';

import { styles } from './styles';

const FAILURE_COPY: Record<AllowanceStatus, string> = {
  paused: "Couldn't pause the agent. Try again.",
  active: "Couldn't resume the agent. Try again.",
};

type PauseControlProps = {
  allowance: Allowance;
  onUpdated: (allowance: Allowance) => void;
};

export const PauseControl = ({ allowance, onUpdated }: PauseControlProps) => {
  const { run } = useConnection();
  const [optimistic, setOptimistic] = useState<AllowanceStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const status = optimistic ?? allowance.status;

  const toggle = async () => {
    const next: AllowanceStatus = status === 'active' ? 'paused' : 'active';
    setOptimistic(next);
    setFailure(null);

    const saved = await run(async (connection) => {
      onUpdated(await setAllowanceStatus(connection, allowance.id, next));
    });

    setOptimistic(null);

    if (!saved) {
      setFailure(FAILURE_COPY[next]);
    }
  };

  return (
    <View style={styles.container}>
      {status === 'paused' ? (
        <>
          <Body style={styles.paused}>Agent paused. Payments will be refused.</Body>
          <Button title="Resume" large onPress={() => void toggle()} />
        </>
      ) : (
        <Button title="Pause agent" variant="warning" large onPress={() => void toggle()} />
      )}
      {failure && (
        <Muted style={styles.failure} accessibilityLiveRegion="assertive">
          {failure}
        </Muted>
      )}
    </View>
  );
};
