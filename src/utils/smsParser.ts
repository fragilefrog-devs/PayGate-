/**
 * PayGate MFS SMS Ingest & Parser Engine
 * Handles parsing, normalization, and deduplication for bKash, Nagad, and Rocket incoming SMS.
 */

import { ProviderType, ParsedSmsResult } from '../types';
import { normalizeReference } from './reference';

export function parseAmountToPaisa(amountStr: string): number {
  if (!amountStr) return 0;
  // Remove currency words, commas, spaces
  const cleaned = amountStr.replace(/[^0-9.]/g, '');
  const floatVal = parseFloat(cleaned);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

export function formatPaisaToBDT(paisa: number): string {
  const tk = (paisa / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Tk ${tk}`;
}

export function formatBDTAmountOnly(paisa: number): string {
  return (paisa / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Validates user-submitted TrxID format based on provider rules
 */
export function validateTrxIdFormat(trxId: string, provider: ProviderType): { isValid: boolean; message?: string } {
  const cleaned = trxId.trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, message: 'Transaction ID is required' };
  }

  // Common typo checks
  if (cleaned.length < 6) {
    return { isValid: false, message: 'TrxID is too short (must be at least 6 characters)' };
  }
  if (cleaned.length > 16) {
    return { isValid: false, message: 'TrxID is too long (maximum 16 characters)' };
  }

  if (provider === 'bkash') {
    // bKash: usually 10 characters alphanumeric
    const validBkash = /^[A-Z0-9]{8,12}$/.test(cleaned);
    if (!validBkash) {
      return { isValid: false, message: 'bKash TrxID is typically 10 alphanumeric characters (e.g. DJC9SZQV0J)' };
    }
  } else if (provider === 'nagad') {
    // Nagad: 8-10 alphanumeric characters
    const validNagad = /^[A-Z0-9]{8,12}$/.test(cleaned);
    if (!validNagad) {
      return { isValid: false, message: 'Nagad TxnID is typically 8-10 alphanumeric characters (e.g. 74BK992Q)' };
    }
  } else if (provider === 'rocket') {
    // Rocket: 8-12 digits or alphanumeric
    const validRocket = /^[A-Z0-9]{8,12}$/.test(cleaned);
    if (!validRocket) {
      return { isValid: false, message: 'Rocket TxnId is typically 8-10 digits or alphanumeric (e.g. 9845728190)' };
    }
  } else if (provider === 'upay') {
    // Upay: 8-12 alphanumeric characters
    const validUpay = /^[A-Z0-9]{8,12}$/.test(cleaned);
    if (!validUpay) {
      return { isValid: false, message: 'Upay TrxID is typically 8-12 alphanumeric characters (e.g. UP84920183)' };
    }
  } else if (provider === 'cellfin') {
    // Cellfin: 8-12 alphanumeric characters
    const validCellfin = /^[A-Z0-9]{8,12}$/.test(cleaned);
    if (!validCellfin) {
      return { isValid: false, message: 'Cellfin Trx ID is typically 8-12 alphanumeric characters (e.g. CF98234190)' };
    }
  }

  return { isValid: true };
}

/**
 * Parses raw incoming SMS from MFS provider
 */
export function parseIncomingSms(
  rawBody: string,
  sender: string = '',
  simSlot: 1 | 2 = 1
): ParsedSmsResult {
  const text = rawBody.trim();
  const lowerSender = sender.toLowerCase();
  const lowerText = text.toLowerCase();

  // Detect provider from sender header or body pattern
  let provider: ProviderType = 'bkash';
  if (lowerSender.includes('upay') || lowerText.includes('upay')) {
    provider = 'upay';
  } else if (lowerSender.includes('cellfin') || lowerSender.includes('ibbl') || lowerText.includes('cellfin')) {
    provider = 'cellfin';
  } else if (lowerSender.includes('nagad') || lowerText.includes('nagad')) {
    provider = 'nagad';
  } else if (lowerSender.includes('rocket') || lowerSender.includes('dbbl') || lowerText.includes('rocket') || lowerText.includes('a/c balance')) {
    provider = 'rocket';
  } else if (lowerSender.includes('bkash') || lowerText.includes('bkash') || lowerText.includes('trxid')) {
    provider = 'bkash';
  }

  let amountPaisa = 0;
  let trxId = '';
  let refRaw = '';
  let balanceAfterPaisa = 0;

  // 1. bKash parsing:
  // e.g. "You have received Tk 1,200.00 from 01712750278. Fee Tk 0.00. Balance Tk 1,200.00. TrxID DJC9SZQV0J and Ref K7M4X2QH at 12/10/2026 15:24."
  if (provider === 'bkash') {
    const amountMatch = text.match(/(?:received|Tk\.?)\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                       text.match(/Tk\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      amountPaisa = parseAmountToPaisa(amountMatch[1]);
    }

    const trxMatch = text.match(/TrxID\s*[:\s]?\s*([A-Za-z0-9]+)/i);
    if (trxMatch) {
      trxId = trxMatch[1].trim().toUpperCase();
    }

    const refMatch = text.match(/Ref\s*[:\s]?\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      refRaw = refMatch[1].trim();
    }

    const balanceMatch = text.match(/Balance\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balanceMatch) {
      balanceAfterPaisa = parseAmountToPaisa(balanceMatch[1]);
    }
  }

  // 2. Nagad parsing:
  // e.g. "Tk 1,200.00 received from 01812345678. TxnID 74BK992Q at 12/10/2026 15:24. Ref: K7M4X2QH. Balance: Tk 1,200.00."
  else if (provider === 'nagad') {
    const amountMatch = text.match(/Tk\s*([0-9,]+(?:\.[0-9]{2})?)\s*received/i) ||
                       text.match(/(?:received|amount)\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      amountPaisa = parseAmountToPaisa(amountMatch[1]);
    }

    const txnMatch = text.match(/(?:TxnID|TrxID|ID)\s*[:\s]?\s*([A-Za-z0-9]+)/i);
    if (txnMatch) {
      trxId = txnMatch[1].trim().toUpperCase();
    }

    const refMatch = text.match(/Ref\s*[:\s]?\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      refRaw = refMatch[1].trim();
    }

    const balanceMatch = text.match(/Balance\s*[:\s]?(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balanceMatch) {
      balanceAfterPaisa = parseAmountToPaisa(balanceMatch[1]);
    }
  }

  // 3. Rocket parsing:
  // e.g. "Cash In Tk 1,200.00 from 01912345678 received. TxnId: 9845728190, Ref: K7M4X2QH. A/C Balance: Tk 1,200.00."
  else if (provider === 'rocket') {
    const amountMatch = text.match(/(?:Tk\.?)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      amountPaisa = parseAmountToPaisa(amountMatch[1]);
    }

    const txnMatch = text.match(/(?:TxnId|TrxId|TxnID)\s*[:\s]?\s*([A-Za-z0-9]+)/i);
    if (txnMatch) {
      trxId = txnMatch[1].trim().toUpperCase();
    }

    const refMatch = text.match(/Ref\s*[:\s]?\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      refRaw = refMatch[1].trim();
    }

    const balanceMatch = text.match(/(?:A\/C Balance|Balance)\s*[:\s]?(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balanceMatch) {
      balanceAfterPaisa = parseAmountToPaisa(balanceMatch[1]);
    }
  }

  // 4. Upay parsing:
  // e.g. "You have received Tk 1,200.00 from 01712750278. TrxID UP84920183 and Ref K7M4X2QH. Fee Tk 0.00. Balance Tk 18,400.00."
  else if (provider === 'upay') {
    const amountMatch = text.match(/(?:received|Tk\.?)\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                       text.match(/Tk\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      amountPaisa = parseAmountToPaisa(amountMatch[1]);
    }

    const trxMatch = text.match(/(?:TrxID|TxnID|ID)\s*[:\s]?\s*([A-Za-z0-9]+)/i);
    if (trxMatch) {
      trxId = trxMatch[1].trim().toUpperCase();
    }

    const refMatch = text.match(/Ref\s*[:\s]?\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      refRaw = refMatch[1].trim();
    }

    const balanceMatch = text.match(/Balance\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balanceMatch) {
      balanceAfterPaisa = parseAmountToPaisa(balanceMatch[1]);
    }
  }

  // 5. Cellfin parsing:
  // e.g. "Payment received Tk 1,200.00 from Cellfin A/C 01712750278. Trx ID CF98234190. Ref: K7M4X2QH. Available Bal Tk 25,600.00."
  else if (provider === 'cellfin') {
    const amountMatch = text.match(/(?:received|amount|Tk\.?)\s*(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                       text.match(/Tk\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (amountMatch) {
      amountPaisa = parseAmountToPaisa(amountMatch[1]);
    }

    const trxMatch = text.match(/(?:Trx\s*ID|TxnID|TrxID)\s*[:\s]?\s*([A-Za-z0-9]+)/i);
    if (trxMatch) {
      trxId = trxMatch[1].trim().toUpperCase();
    }

    const refMatch = text.match(/Ref\s*[:\s]?\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      refRaw = refMatch[1].trim();
    }

    const balanceMatch = text.match(/(?:Available\s*Bal|Balance)\s*[:\s]?(?:Tk\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balanceMatch) {
      balanceAfterPaisa = parseAmountToPaisa(balanceMatch[1]);
    }
  }

  const refNormalized = refRaw ? normalizeReference(refRaw) : '';
  const isValid = amountPaisa > 0 && trxId.length > 0;

  return {
    provider,
    trxId,
    amountPaisa,
    balanceAfterPaisa,
    refRaw,
    refNormalized,
    sender: sender || provider.toUpperCase(),
    simSlot,
    timestamp: new Date().toISOString(),
    isValid,
    error: isValid ? undefined : 'Could not extract valid amount or TrxID from SMS text',
  };
}
