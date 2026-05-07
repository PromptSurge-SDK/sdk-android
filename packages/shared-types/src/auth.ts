import { z } from 'zod';

export const SignupRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
});
export type SignupRequest = z.infer<typeof SignupRequest>;

export const LoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const CreateAppRequest = z.object({
  name: z.string().min(1).max(120),
  playStoreUrl: z.string().url().optional(),
  appStoreUrl: z.string().url().optional(),
  storeMeta: z
    .object({
      storeIconUrl: z.string().url().optional(),
      publisherName: z.string().max(200).optional(),
      playRating: z.number().min(0).max(5).optional(),
      appStoreRating: z.number().min(0).max(5).optional(),
      playReviewCount: z.number().int().nonnegative().optional(),
      appStoreReviewCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type CreateAppRequest = z.infer<typeof CreateAppRequest>;

export const SessionResponse = z.object({
  token: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
  developer: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});
export type SessionResponse = z.infer<typeof SessionResponse>;
