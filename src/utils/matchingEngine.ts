/**
 * PayGate Matching Engine
 * Implements the atomic transaction matching rules per PRD v3.0 Section 4.
 */

import { Payment, IncomingTxn, ReviewReason } from '../types';

export interface MatchEvaluationResult {
  outcome: 'matched' | 'conflict' | 'already_claimed' | 'no_evidence' | 'expired_claim';
  matchedBy?: 'trxid' | 'trxid+reference' | 'auto_confirm';
  reviewReason?: ReviewReason;
  errorMessage?: string;
  matchedTxn?: IncomingTxn;
}

/**
 * Checks a payment against available incoming transactions
 */
export function evaluatePaymentMatch(
  payment: Payment,
  incomingTxns: IncomingTxn[]
): MatchEvaluationResult {
  const submittedTrx = (payment.submittedTrxId || '').trim().toUpperCase();

  // If customer hasn't submitted a TrxID yet, check if auto-confirm applies
  if (!submittedTrx) {
    // Check if any incoming transaction carries the payment's exact normalized reference
    const refMatch = incomingTxns.find(
      (txn) =>
        txn.refNormalized &&
        txn.refNormalized === payment.reference &&
        !txn.claimedPaymentId
    );

    if (refMatch) {
      if (refMatch.amountPaisa === payment.amountPaisa) {
        return {
          outcome: 'matched',
          matchedBy: 'auto_confirm',
          matchedTxn: refMatch,
        };
      } else {
        return {
          outcome: 'conflict',
          reviewReason: refMatch.amountPaisa < payment.amountPaisa ? 'underpaid' : 'overpaid',
          errorMessage: `Received ${refMatch.amountPaisa / 100} BDT, expected ${payment.amountPaisa / 100} BDT`,
          matchedTxn: refMatch,
        };
      }
    }

    return { outcome: 'no_evidence' };
  }

  // Find incoming transactions with matching TrxID (case-insensitive)
  const matchingTxns = incomingTxns.filter(
    (txn) => txn.trxId.toUpperCase() === submittedTrx
  );

  if (matchingTxns.length === 0) {
    return {
      outcome: 'no_evidence',
      errorMessage: 'No SMS received for this Transaction ID yet',
    };
  }

  // Look for the specific transaction
  const txn = matchingTxns[0];

  // Check if TrxID is already claimed by ANOTHER payment
  if (txn.claimedPaymentId && txn.claimedPaymentId !== payment.id) {
    return {
      outcome: 'already_claimed',
      errorMessage: 'This TrxID was already used for another payment',
    };
  }

  // Check if payment has expired
  const now = new Date();
  const expiresAt = new Date(payment.expiresAt);
  if (now > expiresAt) {
    return {
      outcome: 'expired_claim',
      reviewReason: 'late_payment',
      errorMessage: 'Payment window expired before matching confirmation',
      matchedTxn: txn,
    };
  }

  // Check receiving wallet: must be in offered_wallet_ids
  const walletMatched = payment.offeredWalletIds.includes(txn.walletId);
  if (!walletMatched) {
    return {
      outcome: 'conflict',
      reviewReason: 'wrong_wallet',
      errorMessage: 'Payment was sent to a different wallet than assigned',
      matchedTxn: txn,
    };
  }

  // Check provider
  if (txn.provider !== payment.provider) {
    return {
      outcome: 'conflict',
      reviewReason: 'wrong_wallet',
      errorMessage: `Provider mismatch: expected ${payment.provider}, received ${txn.provider}`,
      matchedTxn: txn,
    };
  }

  // Check amount
  if (txn.amountPaisa !== payment.amountPaisa) {
    const isUnder = txn.amountPaisa < payment.amountPaisa;
    return {
      outcome: 'conflict',
      reviewReason: isUnder ? 'underpaid' : 'overpaid',
      errorMessage: `Amount mismatch: expected Tk ${(payment.amountPaisa / 100).toFixed(2)}, received Tk ${(txn.amountPaisa / 100).toFixed(2)}`,
      matchedTxn: txn,
    };
  }

  // Check reference cross-check if present in SMS
  if (txn.refNormalized && txn.refNormalized.length > 0) {
    if (txn.refNormalized !== payment.reference) {
      return {
        outcome: 'conflict',
        reviewReason: 'conflict',
        errorMessage: `Reference mismatch in SMS: expected ${payment.reference}, found ${txn.refNormalized}`,
        matchedTxn: txn,
      };
    }
    // Both TrxID and Reference agree!
    return {
      outcome: 'matched',
      matchedBy: 'trxid+reference',
      matchedTxn: txn,
    };
  }

  // Confirmed match by TrxID alone (valid wallet, amount, provider)
  return {
    outcome: 'matched',
    matchedBy: 'trxid',
    matchedTxn: txn,
  };
}
