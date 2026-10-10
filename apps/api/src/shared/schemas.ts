import { isAddress } from '@solana/kit';
import { z } from 'zod';

export const solanaAddressSchema = z
  .string()
  .refine(isAddress, 'must be a base58 Solana address')
  .meta({ example: '5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj' });
