/**
 * PayGate Reference Generator and Check-Character Validator
 *
 * Requirements:
 * - Exactly 8 characters (7 random payload + 1 check character)
 * - Charset excludes look-alikes: '0', 'O', '1', 'I', 'L'
 * - Single-use, case-insensitive normalized matching
 * - Catch single-character typos and common adjacent transpositions
 */

// 31 distinct characters avoiding look-alikes (0/O, 1/I/L)
export const REFERENCE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CHARSET_MAP = new Map<string, number>();
for (let i = 0; i < REFERENCE_CHARSET.length; i++) {
  CHARSET_MAP.set(REFERENCE_CHARSET[i], i);
}

/**
 * Normalizes user/SMS input: uppercase, strip spaces, hyphens, and punctuation
 */
export function normalizeReference(raw: string): string {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    // replace accidental look-alikes that a user might have typed
    .replace(/O/g, '0') // handle during cleanup if needed, but in strict check we validate against charset
    .trim();
}

/**
 * Computes check character for a 7-character base string using weighted modulo
 */
export function computeCheckChar(base7: string): string {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const char = base7[i];
    const val = CHARSET_MAP.get(char) ?? 0;
    // Weight factors: prime-based to detect swaps and typos
    const weight = ((i * 3) + 7) % 31 + 1;
    sum = (sum + val * weight) % 31;
  }
  return REFERENCE_CHARSET[sum % REFERENCE_CHARSET.length];
}

/**
 * Generates a compliant 8-character PayGate payment reference
 */
export function generateReference(): string {
  let base7 = '';
  for (let i = 0; i < 7; i++) {
    const randIdx = Math.floor(Math.random() * REFERENCE_CHARSET.length);
    base7 += REFERENCE_CHARSET[randIdx];
  }
  const checkChar = computeCheckChar(base7);
  return `${base7}${checkChar}`;
}

/**
 * Validates whether an 8-character string has valid length and passes check-character validation
 */
export function validateReference(ref: string): { isValid: boolean; normalized: string; error?: string } {
  if (!ref) return { isValid: false, normalized: '', error: 'Reference cannot be empty' };

  const cleaned = ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 8) {
    return {
      isValid: false,
      normalized: cleaned,
      error: `Reference must be exactly 8 characters (received ${cleaned.length})`,
    };
  }

  // Check valid characters
  for (let i = 0; i < 8; i++) {
    if (!CHARSET_MAP.has(cleaned[i])) {
      return {
        isValid: false,
        normalized: cleaned,
        error: `Reference contains invalid character "${cleaned[i]}" (lookalikes 0, O, 1, I, L not permitted)`,
      };
    }
  }

  const base7 = cleaned.slice(0, 7);
  const actualCheck = cleaned[7];
  const expectedCheck = computeCheckChar(base7);

  if (actualCheck !== expectedCheck) {
    return {
      isValid: false,
      normalized: cleaned,
      error: 'Reference check character failed. Please check for a typo.',
    };
  }

  return { isValid: true, normalized: cleaned };
}
