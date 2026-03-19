import { CURRENCIES, REGIONS } from './utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isValidCurrency(value: string): boolean {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function isValidRegion(value: string): boolean {
  return (REGIONS as readonly string[]).includes(value);
}

export function isValidDateString(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime());
}

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'pdf', 'xlsx', 'docx', 'pptx', 'csv', 'txt',
]);

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.has(mimeType);
}

export function isAllowedExtension(ext: string): boolean {
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

export interface AttachmentInput {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export function validateAttachments(value: unknown): AttachmentInput[] | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    if (typeof item.id !== 'string' || typeof item.name !== 'string' ||
        typeof item.url !== 'string' || typeof item.size !== 'number' ||
        typeof item.type !== 'string' || typeof item.uploadedAt !== 'string') {
      return null;
    }
  }
  return value as AttachmentInput[];
}

/**
 * Lightweight runtime type checker for API responses.
 * Validates that the response has the expected shape.
 */
export function assertShape<T>(value: unknown, requiredKeys: string[]): value is T {
  if (typeof value !== 'object' || value === null) return false;
  for (const key of requiredKeys) {
    if (!(key in value)) return false;
  }
  return true;
}

export function assertArrayShape<T>(value: unknown, requiredKeys: string[]): value is T[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return assertShape<T>(value[0], requiredKeys);
}

const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'question', 'general'] as const;
const FEEDBACK_STATUSES = ['new', 'in_progress', 'resolved', 'dismissed'] as const;
const FEEDBACK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export function isValidFeedbackCategory(value: string): value is typeof FEEDBACK_CATEGORIES[number] {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function isValidFeedbackStatus(value: string): value is typeof FEEDBACK_STATUSES[number] {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function isValidFeedbackPriority(value: string): value is typeof FEEDBACK_PRIORITIES[number] {
  return (FEEDBACK_PRIORITIES as readonly string[]).includes(value);
}
