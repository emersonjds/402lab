import { atomicStringSchema, serviceSchema } from '@402lab/shared';
import { z } from 'zod';

export const serviceModeSchema = z.enum(['live', 'demo']);

export const serviceListingSchema = serviceSchema
  .pick({ id: true, name: true, description: true, upstream: true, provider: true })
  .extend({ price: atomicStringSchema, mode: serviceModeSchema });

export const serviceListResponseSchema = z.object({ services: z.array(serviceListingSchema) });

export type ServiceMode = z.infer<typeof serviceModeSchema>;
export type ServiceListResponse = z.infer<typeof serviceListResponseSchema>;
