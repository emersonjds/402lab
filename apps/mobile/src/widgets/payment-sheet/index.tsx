import { cardCostEquivalent, computeSplit, explorerTxUrl, formatUsd } from '@402lab/shared';
import { setStringAsync } from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';

import { PROVIDER_NAMES, findService, serviceName, type Payment } from '@/entities/payment';
import { Body, Button, Mono, Muted, Title } from '@/shared/ui';

import { styles } from './styles';

const ROLE_LABELS = { provider: 'Provider', integrator: 'Integrator', platform: 'Platform' };

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Muted>{label}</Muted>
    <Mono>{value}</Mono>
  </View>
);

type PaymentSheetProps = { payment: Payment | null; onClose: () => void };

export const PaymentSheet = ({ payment, onClose }: PaymentSheetProps) => {
  const [copied, setCopied] = useState(false);
  const service = payment ? findService(payment.serviceId) : undefined;

  const close = () => {
    setCopied(false);
    onClose();
  };

  const copySignature = async (signature: string) => {
    await setStringAsync(signature);
    setCopied(true);
  };

  return (
    <Modal visible={payment !== null} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        {payment && (
          <View style={styles.sheet}>
            <Title>{serviceName(payment.serviceId)}</Title>
            {service && <Body style={styles.provider}>{PROVIDER_NAMES[service.upstream]}</Body>}
            <Row label="Amount" value={formatUsd(payment.amount)} />
            <Row
              label="Card + IOF would cost"
              value={formatUsd(cardCostEquivalent(payment.amount))}
            />
            {service &&
              computeSplit(payment.amount, service.splits).map((line) => (
                <Row
                  key={line.role}
                  label={ROLE_LABELS[line.role]}
                  value={formatUsd(line.amount)}
                />
              ))}
            <View style={styles.signature}>
              <Mono style={styles.signatureText} selectable>
                {payment.txSignature}
              </Mono>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy signature"
                style={styles.copy}
                onPress={() => void copySignature(payment.txSignature)}
              >
                <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.link}
              onPress={() => void Linking.openURL(explorerTxUrl(payment.txSignature))}
            >
              <Text style={styles.linkText}>View on Solscan ↗</Text>
            </Pressable>
            <Button title="Close" variant="ghost" onPress={close} />
          </View>
        )}
      </View>
    </Modal>
  );
};
