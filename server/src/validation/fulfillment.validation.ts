import { z } from 'zod';

import {
  ORDER_COD_STATUS_VALUES,
  SHIPMENT_STATUS_VALUES,
} from '../models/order.model';
import { STORE_COURIER_VALUES } from '../models/store.model';

export const updateShippingRulesSchema = z.object({
  baseFee: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Base fee must be a valid number').min(0, 'Base fee cannot be negative'),
  ),
  freeShippingAbove: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Free shipping threshold must be a valid number').min(0, 'Free shipping threshold cannot be negative'),
  ),
  codEnabled: z.preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        return value === 'true' || value === '1' || value.toLowerCase() === 'on';
      }

      return false;
    },
    z.boolean(),
  ),
  codFee: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('COD fee must be a valid number').min(0, 'COD fee cannot be negative'),
  ),
  defaultCourier: z.enum(STORE_COURIER_VALUES),
  supportedCouriers: z.array(z.enum(STORE_COURIER_VALUES)).min(1, 'At least one courier is required'),
});

export const createShipmentSchema = z.object({
  courier: z.enum(STORE_COURIER_VALUES).optional(),
  note: z.string().trim().max(240, 'Note is too long').optional(),
});

export const updateShipmentStatusSchema = z.object({
  status: z.enum(SHIPMENT_STATUS_VALUES),
  note: z.string().trim().max(240, 'Note is too long').optional(),
});

export const updateCodTrackingSchema = z.object({
  codStatus: z.enum(ORDER_COD_STATUS_VALUES),
  collectedAmount: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }

        return typeof value === 'string' ? Number(value) : value;
      },
      z.number().finite('Collected amount must be a valid number').min(0, 'Collected amount cannot be negative').optional(),
    )
    .optional(),
  note: z.string().trim().max(240, 'Note is too long').optional(),
});

export const courierQuoteSchema = z.object({
  destination: z.string().trim().min(3, 'Destination is required').max(255, 'Destination is too long'),
  weightKg: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Weight must be a valid number').min(0.1, 'Weight must be at least 0.1kg').max(100, 'Weight is too high').default(1),
  ),
});

export type UpdateShippingRulesInput = z.infer<typeof updateShippingRulesSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;
export type UpdateCodTrackingInput = z.infer<typeof updateCodTrackingSchema>;
export type CourierQuoteInput = z.infer<typeof courierQuoteSchema>;
