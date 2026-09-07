import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { orchestrateScan } from '../src/scanners';
import { createOpenRouterAiGateway, MODELS } from '../src/services/ai';
import type { AiGateway } from '../src/services/ai';
import { campaignInputSchema } from '../src/validators/campaignInput';

const metadataSchema = z.object({ provider: z.string().optional(), choices: z.array(z.object({ message: z.object({ content: z.string() }) })).optional(), usage: z.object({
  cost: z.number().optional(), is_byok: z.boolean().optional(),
  cost_details: z.object({ upstream_inference_cost: z.number().optional() }).optional(),
}).optional() });

async function main() {
  const { values } = parseArgs({ options: { output: { type: 'string' } } });
  const url = process.env.AI_GATEWAY_URL;
  const token = process.env.CF_AIG_TOKEN;
  if (!values.output || !url || !token || !/^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/[^/]+\/[^/]+\/openrouter\/(?:v1\/)?chat\/completions$/.test(url)) {
    console.error('Provide --output (new file), AI_GATEWAY_URL (Cloudflare OpenRouter route), and CF_AIG_TOKEN. Synthetic-only, billable evaluation.');
    process.exitCode = 1;
    return;
  }
  const base = campaignInputSchema.parse({
    useCaseType: 'MARKETING', businessName: 'BrightMarket',
    campaignDescription: 'BrightMarket sells cotton towels and sends one weekly discount on its own towels to customers who explicitly opt in at checkout. Messages identify BrightMarket and include opt-out instructions.',
    sampleMessages: ['BrightMarket: Save 10% on our cotton towels this week. Shop https://brightmarket.example/towels. Reply STOP to unsubscribe or HELP for help.', 'BrightMarket: This week, get 15% off our cotton bath towels. Shop https://brightmarket.example/bath-towels. Reply STOP to unsubscribe or HELP for help.'],
    messageFlow: 'Customers see this disclosure beside an optional unchecked box at https://brightmarket.example/checkout: "By checking this box, I agree to receive one BrightMarket promotional text per week. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase." They must actively check the box. BrightMarket stores the disclosure version, timestamp, page URL and consent record.',
    optInMessage: 'BrightMarket: You subscribed to one promotional text per week. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.',
    optOutMessage: 'BrightMarket: You have been unsubscribed and will no longer receive messages.',
    helpMessage: 'BrightMarket support: https://brightmarket.example/support. Reply STOP to unsubscribe.',
    optOutKeywords: ['STOP'], helpKeywords: ['HELP'], embeddedLinks: true, embeddedPhoneNumbers: false,
    privacyPolicyUrl: 'https://brightmarket.example/privacy', termsOfServiceUrl: 'https://brightmarket.example/terms',
  });
  const cases = [
    { name: 'green', expectedTier: 'GREEN', input: base },
    { name: 'yellow-policy', expectedTier: 'YELLOW', input: base },
    { name: 'red-missing-facts', expectedTier: 'RED', input: campaignInputSchema.parse({ ...base, optOutKeywords: ['CANCEL'], messageFlow: 'Customers consent.',
      sampleMessages: ['Save 10% on our cotton towels this week. Shop https://brightmarket.example/towels. Reply STOP to unsubscribe.', 'Get 15% off our cotton bath towels this week. Shop https://brightmarket.example/bath-towels. Reply STOP to unsubscribe.'] }) },
  ];
  // Three fixed concurrent scans exercise the actual orchestration and one global
  // deadline per scan. Crawled pages are synthetic; Firecrawl latency is not measured.
  const results = await Promise.all(cases.map(async (testCase) => {
    const calls: { synthesis: boolean; status: number; durationMs: number; provider: string | null; cost: number | null; syntheticDraft?: string }[] = [];
    const transport = createOpenRouterAiGateway({ url, token });
    const gateway: AiGateway = { complete: async (request, options) => {
      const started = Date.now();
      const response = await transport.complete(request, options).catch(() => ({ ok: false, status: 0, body: null }));
      const metadata = metadataSchema.safeParse(response.body);
      calls.push({ synthesis: request.max_tokens === 4096, status: response.status, durationMs: Date.now() - started,
        provider: metadata.success ? metadata.data.provider ?? null : null,
        // Only this built-in synthetic evaluator retains synthesis for human review, never production logs.
        syntheticDraft: request.max_tokens === 4096 && metadata.success ? metadata.data.choices?.[0]?.message.content : undefined,
        cost: metadata.success ? (metadata.data.usage?.is_byok ? metadata.data.usage.cost_details?.upstream_inference_cost : metadata.data.usage?.cost) ?? null : null });
      return response;
    } };
    const result = await orchestrateScan(testCase.input, { RULES_VERSION: 'synthetic-revision-evaluation' }, gateway, false, `synthetic-${testCase.name}`, MODELS.premium, {
      crawler: { scrape: async (pageUrl) => {
        const privacy = pageUrl.endsWith('/privacy');
        if (privacy && testCase.name === 'red-missing-facts') return { success: false, statusCode: 404, content: '' };
        return { success: true, statusCode: 200, content: privacy
          ? testCase.name === 'yellow-policy'
            ? 'BrightMarket collects purchase information to fulfill orders. We safeguard customer records and use service providers to operate our store. Customers may contact us to request access or deletion.'
            : 'BrightMarket SMS Privacy Policy: We collect phone numbers and consent records only after explicit opt-in. We use messaging providers to deliver requested texts. We do not sell or share mobile opt-in data for third-party marketing. We retain consent records as required for compliance; customers may request access and deletion.'
          : 'BrightMarket SMS Terms: Receive one promotional text per week after explicit consent. Message and data rates may apply. Reply STOP to unsubscribe or HELP for support. Consent is not a condition of purchase.' };
      } },
    });
    const pack = result.revisionPack;
    const packBehaviorPass = pack?.status === 'available' && (testCase.name === 'green'
      ? pack.actions.length === 0 && pack.replacements.length === 0
      : testCase.name === 'yellow-policy'
        ? pack.actions.some((action) => action.field === 'privacyPolicy') && pack.replacements.length === 0
        : pack.actions.some((action) => action.field === 'messageFlow' && action.kind === 'provide_information')
          && !pack.replacements.some((replacement) => replacement.field === 'messageFlow')
          && pack.replacements.some((replacement) => replacement.field === 'sampleMessages'
            && replacement.value.every((message, index) => message === `BrightMarket\n${testCase.input.sampleMessages[index]}`)));
    const passed = result.overallTier === testCase.expectedTier && packBehaviorPass
      && result.metadata.fieldsAnalyzed === 11 && !result.metadata.partial && result.metadata.scanDurationMs < 45000
      && calls.every((call) => call.status === 200 && call.provider === 'Anthropic');
    console.log(`${testCase.name}: ${passed ? 'PASS' : 'FAIL'}; pack=${result.revisionPack?.status}; durationMs=${result.metadata.scanDurationMs}; calls=${calls.length}`);
    return { ...testCase, passed, packBehaviorPass, calls, result };
  }));
  await writeFile(values.output, JSON.stringify({ evaluatedAt: new Date().toISOString(), syntheticPages: true, concurrency: 3, results }, null, 2), { flag: 'wx', mode: 0o600 });
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main().catch(() => { console.error('Synthetic revision evaluation failed; no provider details logged.'); process.exitCode = 1; });
