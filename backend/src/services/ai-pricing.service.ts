import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

export interface AiPriceSnapshot {
  input: string; output: string; thinking: string;
  billingMode: 'FREE' | 'PAID'; source: 'FREE_TIER' | 'ADMIN' | 'ENV';
  model: string; currency: 'USD'; unit: number;
}

export async function resolveAiPrice(db: Pick<Prisma.TransactionClient, 'aiPrice'>, model: string): Promise<{ version: string | null; snapshot?: AiPriceSnapshot }> {
  const common = { model, currency: 'USD' as const, unit: 1000000 };
  if (env.AI_BILLING_MODE === 'FREE') return { version: 'gemini-free-tier', snapshot: { ...common, input: '0', output: '0', thinking: '0', billingMode: 'FREE', source: 'FREE_TIER' } };
  const price = await db.aiPrice.findFirst({ where: { model }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  if (price) return { version: price.id, snapshot: { ...common, input: price.inputUsd.toString(), output: price.outputUsd.toString(), thinking: price.outputUsd.toString(), billingMode: 'PAID', source: 'ADMIN' } };
  const input = env.AI_INPUT_USD_PER_MILLION_TOKENS, output = env.AI_OUTPUT_USD_PER_MILLION_TOKENS;
  if (model === env.GEMINI_MODEL && input !== undefined && output !== undefined) return { version: `env:${model}:${input}:${output}`, snapshot: { ...common, input: String(input), output: String(output), thinking: String(output), billingMode: 'PAID', source: 'ENV' } };
  return { version: null };
}

export async function getAiBillingInfo() {
  const price = await resolveAiPrice(prisma, env.GEMINI_MODEL);
  return { model: env.GEMINI_MODEL, billingMode: env.AI_BILLING_MODE,
    status: price.snapshot ? env.AI_BILLING_MODE === 'FREE' ? 'FREE' : 'CONFIGURED' : 'MISSING',
    inputUsd: price.snapshot?.input ?? null, outputUsd: price.snapshot?.output ?? null,
    priceVersion: price.version, source: price.snapshot?.source ?? null,
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing', rateLimitsUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits' };
}
