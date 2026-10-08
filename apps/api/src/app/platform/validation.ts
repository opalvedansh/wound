import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Parses a request body or query with a zod schema. Problems name the fields only, never their values
 * (values may be patient data), in the `{ message, problems }` shape the portal shows.
 */
export function parse<T extends z.ZodType>(schema: T, input: unknown, message = 'Check the details you entered.'): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const problems = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'body'))];
  throw new BadRequestException({ message, problems });
}

/** YYYY-MM-DD calendar day as UTC midnight; rejects impossible dates. */
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value, ctx) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      ctx.addIssue({ code: 'custom', message: 'not a real date' });
      return z.NEVER;
    }
    return date;
  });

export const pastDay = calendarDay.refine((d) => d.getTime() <= Date.now(), 'in the future');

export const text = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
