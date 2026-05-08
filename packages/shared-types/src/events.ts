import { z } from 'zod';

export const Platform = z.enum(['android', 'ios']);
export type Platform = z.infer<typeof Platform>;

const Common = {
  eventId: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }),
  sessionId: z.string().uuid(),
  deviceId: z.string().min(1).max(128),
  appVersion: z.string().min(1).max(64),
  sdkVersion: z.string().min(1).max(64),
  locale: z.string().min(2).max(35),
  platform: Platform,
  // true = holdout group (pre-prompt suppressed); false = treatment (default)
  holdout: z.boolean().default(false),
};

export const FirstOpenEvent = z.object({
  ...Common,
  eventType: z.literal('first_open'),
  payload: z.object({ installSource: z.string().max(128).optional() }).default({}),
});

export const InitializeEvent = z.object({
  ...Common,
  eventType: z.literal('initialize'),
  payload: z.object({}).default({}),
});

// `resolvedLocale` carries the locale that was actually rendered to the user, after the
// server's fallback chain (e.g. requested `de-DE` → resolved `de`, or `ko` → `en`). Optional
// so older SDK builds without M3 prompt-text awareness still validate.
const PromptShownPayload = z
  .object({ resolvedLocale: z.string().min(2).max(35).optional() })
  .default({});

export const PrePromptShownEvent = z.object({
  ...Common,
  eventType: z.literal('pre_prompt_shown'),
  payload: PromptShownPayload,
});

export const PrePromptConfirmedEvent = z.object({
  ...Common,
  eventType: z.literal('pre_prompt_confirmed'),
  payload: PromptShownPayload,
});

export const PrePromptDismissedEvent = z.object({
  ...Common,
  eventType: z.literal('pre_prompt_dismissed'),
  payload: PromptShownPayload,
});

export const NativePromptRequestedEvent = z.object({
  ...Common,
  eventType: z.literal('native_prompt_requested'),
  payload: PromptShownPayload,
});

export const EventSchema = z.discriminatedUnion('eventType', [
  FirstOpenEvent,
  InitializeEvent,
  PrePromptShownEvent,
  PrePromptConfirmedEvent,
  PrePromptDismissedEvent,
  NativePromptRequestedEvent,
]);
export type Event = z.infer<typeof EventSchema>;

export const EventTypes = [
  'first_open',
  'initialize',
  'pre_prompt_shown',
  'pre_prompt_confirmed',
  'pre_prompt_dismissed',
  'native_prompt_requested',
] as const;
export type EventType = (typeof EventTypes)[number];

export const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(500),
});
export type Batch = z.infer<typeof BatchSchema>;
