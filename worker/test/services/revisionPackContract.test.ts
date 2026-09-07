import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { revisionPackSchema } from '../../src/services/revisionPack';

const specShape = z.object({ components: z.object({ schemas: z.object({
  RevisionPack: z.unknown(),
  ScanResponse: z.object({ required: z.array(z.string()), properties: z.object({ revisionPack: z.object({ $ref: z.string() }) }) }),
}) }) });

describe('revision pack OpenAPI contract', () => {
  it('matches the runtime schema exactly and remains optional on the shared response', async () => {
    const spec = specShape.parse(parse(await readFile(new URL('../../openapi.yaml', import.meta.url), 'utf8')));
    const { $schema: _dialect, ...runtimeSchema } = zodToJsonSchema(revisionPackSchema, { $refStrategy: 'none' });
    expect(spec.components.schemas.RevisionPack).toEqual(runtimeSchema);
    expect(spec.components.schemas.ScanResponse.required).not.toContain('revisionPack');
    expect(spec.components.schemas.ScanResponse.properties.revisionPack.$ref).toBe('#/components/schemas/RevisionPack');
  });

  it.each(['not_authorized', 'timeout', 'incomplete_scan', 'generation_failed', 'input_too_large'])('accepts unavailable/%s with no hidden draft output', (reason) => {
    expect(revisionPackSchema.safeParse({ status: 'unavailable', reason }).success).toBe(true);
    expect(revisionPackSchema.safeParse({ status: 'unavailable', reason, replacements: [] }).success).toBe(false);
  });
});
