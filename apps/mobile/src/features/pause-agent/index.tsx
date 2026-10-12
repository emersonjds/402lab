import { useMutation, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import {
  ALLOWANCES_KEY,
  setAllowanceStatus,
  type Allowance,
  type AllowanceStatus,
} from '@/entities/allowance';
import { useConnection } from '@/entities/session';
import { UnreachableError } from '@/shared/api/client';
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
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const replace = (list: Allowance[] | undefined, next: Allowance) =>
    list?.map((candidate) => (candidate.id === next.id ? next : candidate));

  const mutation = useMutation({
    mutationFn: (next: AllowanceStatus) =>
      connection
        ? setAllowanceStatus(connection, allowance.id, next)
        : Promise.reject(new UnreachableError()),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ALLOWANCES_KEY });
      const previous = queryClient.getQueryData<Allowance[]>(ALLOWANCES_KEY);
      queryClient.setQueryData<Allowance[]>(ALLOWANCES_KEY, (list) =>
        replace(list, { ...allowance, status: next }),
      );
      return { previous };
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(ALLOWANCES_KEY, context?.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Allowance[]>(ALLOWANCES_KEY, (list) => replace(list, updated));
      onUpdated(updated);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ALLOWANCES_KEY }),
  });

  // A poll landing mid-PATCH must not flip the button back.
  const status = mutation.isPending ? mutation.variables : allowance.status;
  const failure = mutation.isError ? FAILURE_COPY[mutation.variables] : null;

  const toggle = () => {
    mutation.mutate(status === 'active' ? 'paused' : 'active');
  };

  return (
    <View style={styles.container}>
      {status === 'paused' ? (
        <>
          <Body style={styles.paused}>Agent paused. Payments will be refused.</Body>
          <Button title="Resume" large onPress={toggle} />
        </>
      ) : (
        <Button title="Pause agent" variant="warning" large onPress={toggle} />
      )}
      {failure && (
        <Muted style={styles.failure} accessibilityLiveRegion="assertive">
          {failure}
        </Muted>
      )}
    </View>
  );
};
