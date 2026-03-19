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
