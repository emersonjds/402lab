import { useEffect, type EffectCallback } from 'react';
import { Text } from 'react-native';

export const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

export const useLocalSearchParams = jest.fn(() => ({}));

export const useFocusEffect = (effect: EffectCallback): void => {
  useEffect(effect, [effect]);
};

export const Redirect = ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>;
