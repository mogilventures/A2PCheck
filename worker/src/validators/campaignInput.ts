import { z } from 'zod';
import { VALID_USE_CASES } from '../utils/useCases';

const urlSchema = z
  .string()
  .url('Must be a valid URL')
  .max(2048, 'URL must be 2048 characters or fewer')
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https' }
  )
  .optional();

export const campaignInputSchema = z.object({
  useCaseType: z.enum([...VALID_USE_CASES] as [string, ...string[]], {
    errorMap: () => ({ message: `Must be one of: ${VALID_USE_CASES.join(', ')}` }),
  }),
  campaignDescription: z
    .string()
    .min(1, 'Campaign description is required')
    .max(4096, 'Campaign description must be under 4096 characters'),
  sampleMessages: z
    .array(z.string().min(1, 'Sample message cannot be empty'))
    .min(2, 'At least 2 sample messages required')
    .max(5, 'Maximum 5 sample messages'),
  messageFlow: z
    .string()
    .min(1, 'Message flow is required')
    .max(4096, 'Message flow must be under 4096 characters'),
  businessName: z.string().optional(),
  privacyPolicyUrl: urlSchema,
  websiteUrl: urlSchema,
  termsOfServiceUrl: urlSchema,
  optInKeywords: z.array(z.string()).optional(),
  optOutKeywords: z.array(z.string()).optional(),
  helpKeywords: z.array(z.string()).optional(),
  optInMessage: z.string().optional(),
  optOutMessage: z.string().optional(),
  helpMessage: z.string().optional(),
  embeddedLinks: z.boolean().optional(),
  embeddedPhoneNumbers: z.boolean().optional(),
  ageGatedContent: z.boolean().optional(),
  directLending: z.boolean().optional(),
  numberPool: z.boolean().optional(),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
