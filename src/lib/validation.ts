export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '').trim().slice(0, 1000);
}

export function validateAndSanitizeId(id: string | null): string | null {
  if (!id) return null;
  const sanitized = sanitizeInput(id);
  if (!isValidUUID(sanitized)) return null;
  return sanitized;
}

export function sanitizeText(text: string, maxLength = 1000): string {
  if (!text) return '';
  return text.replace(/[<>\"'&]/g, '').trim().slice(0, maxLength);
}

export function sanitizePrice(price: string): number | null {
  const cleaned = price.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num <= 0 || num > 100000000) return null;
  return num;
}