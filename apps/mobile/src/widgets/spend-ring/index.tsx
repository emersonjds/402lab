import { formatUsd } from '@402lab/shared';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme } from '@/shared/config/theme';
import { Mono, Muted } from '@/shared/ui';

import { styles } from './styles';

const STROKE = 10;

const progress = (spent: bigint, cap: bigint): number =>
  cap === 0n || spent >= cap ? 1 : Number((spent * 1000n) / cap) / 1000;

type SpendRingProps = {
  spent: bigint;
  cap: bigint;
  size?: number;
  caption?: string;
  label?: boolean;
};

export const SpendRing = ({
  spent,
  cap,
  size = 200,
  caption = 'today',
  label = true,
}: SpendRingProps) => {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = progress(spent, cap);
  const color = ratio >= 1 ? theme.colors.amber : theme.colors.lime;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityLabel={`Spent ${formatUsd(spent)} of ${formatUsd(cap)} ${caption}`}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${String(circumference)} ${String(circumference)}`}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
        />
      </Svg>
      {label && <Mono style={styles.amount}>{formatUsd(spent)}</Mono>}
      {label && <Muted>{`of ${formatUsd(cap)} ${caption}`}</Muted>}
    </View>
  );
};
