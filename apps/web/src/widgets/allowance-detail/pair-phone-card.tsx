'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import QRCode from 'qrcode';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { ApiError, apiRequest } from '@/shared/api/client';
import { mobilePairingSchema } from '@/shared/api/schemas';
import { useSession } from '@/shared/auth/session-context';
import { useModal } from '@/shared/hooks/use-modal';

const API_PUBLIC_URL = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? '';

export const PairPhoneCard = () => {
  const router = useRouter();
  const { signOut } = useSession();
  const revokeModal = useModal();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePair = async () => {
    setPairing(true);
    setError(null);
    try {
      const pair = await apiRequest('/auth/pair', { method: 'POST', schema: mobilePairingSchema });
      const payload = JSON.stringify({ api: API_PUBLIC_URL, token: pair.token });
      setQrDataUrl(await QRCode.toDataURL(payload, { margin: 1, width: 220 }));
      setExpiresAt(pair.expiresAt);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
    } finally {
      setPairing(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await apiRequest('/auth/revoke-devices', { method: 'POST', schema: z.null() });
      revokeModal.closeModal();
      await signOut();
      router.replace('/connect');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
      setRevoking(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Pair your phone</h2>
      <p className="mt-1 text-xs text-muted">
        Scan with the 402Lab app to approve threshold-exceeding transactions or receive push
        alerts for allowance activity.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-error-400">
          {error}
        </p>
      )}

      {qrDataUrl ? (
        <div className="mt-4 grid justify-items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not an optimizable asset */}
          <img src={qrDataUrl} alt="Pairing QR code" width={160} height={160} className="rounded-lg bg-white p-2" />
          {expiresAt && (
            <p className="text-xs text-muted">Expires {new Date(expiresAt).toLocaleDateString()}</p>
          )}
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={pairing}
          onClick={() => void handlePair()}
        >
          {pairing ? 'Generating…' : 'Generate pairing QR'}
        </Button>
      )}

      <Button variant="ghost" className="mt-3 w-full !text-error-400" onClick={revokeModal.openModal}>
        Revoke devices
      </Button>

      <Modal isOpen={revokeModal.isOpen} onClose={revokeModal.closeModal} className="max-w-sm">
        <h3 className="font-display font-semibold text-text">Revoke every device?</h3>
        <p className="mt-2 text-sm text-muted">
          Signs out this browser and every paired phone. You'll need to connect your wallet again.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={revokeModal.closeModal}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            className="flex-1 !border-error-500/50 !text-error-400 hover:!border-error-500"
            disabled={revoking}
            onClick={() => void handleRevoke()}
          >
            {revoking ? 'Revoking…' : 'Revoke all'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
};
