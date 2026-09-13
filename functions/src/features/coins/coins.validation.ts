import { z } from 'zod';

export const adjustCoinsSchema = z.object({
  uid: z.string().trim().min(1, 'Customer is required'),
  transactionType: z.enum(['earned', 'redeemed', 'reversed']),
  coins: z.number().int().refine(value => value !== 0, 'Coins must be a nonzero number'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export type AdjustCoinsInput = z.infer<typeof adjustCoinsSchema>;
