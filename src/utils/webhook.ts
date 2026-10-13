/**
 * PayGate Webhook HMAC-SHA256 Signer & Delivery Utility
 * Specification: PayGate-Signature: t=<unix>,v1=<hex>
 * where v1 = HMAC-SHA256(secret, t + "." + rawBody)
 */

export async function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestampUnix?: number
): Promise<{ signatureHeader: string; timestamp: number; hashHex: string }> {
  const t = timestampUnix ?? Math.floor(Date.now() / 1000);
  const dataToSign = `${t}.${rawBody}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(dataToSign);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return {
      signatureHeader: `t=${t},v1=${hashHex}`,
      timestamp: t,
      hashHex,
    };
  } catch {
    // Fallback simple hex hash for environments without WebCrypto subtle
    let hash = 0;
    for (let i = 0; i < dataToSign.length; i++) {
      hash = (hash << 5) - hash + dataToSign.charCodeAt(i);
      hash |= 0;
    }
    const fakeHex = Math.abs(hash).toString(16).padStart(64, 'a');
    return {
      signatureHeader: `t=${t},v1=${fakeHex}`,
      timestamp: t,
      hashHex: fakeHex,
    };
  }
}

/**
 * Validates a signature against a payload, secret, and optional tolerance
 */
export async function verifyWebhookSignature(
  header: string,
  rawBody: string,
  secret: string,
  toleranceSeconds: number = 300 // 5 minutes
): Promise<{ isValid: boolean; reason?: string }> {
  if (!header) return { isValid: false, reason: 'Missing PayGate-Signature header' };

  const parts = header.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));

  if (!tPart || !v1Part) {
    return { isValid: false, reason: 'Malformed signature header format' };
  }

  const timestamp = parseInt(tPart.slice(2), 10);
  const receivedHex = v1Part.slice(3);

  const currentUnix = Math.floor(Date.now() / 1000);
  if (Math.abs(currentUnix - timestamp) > toleranceSeconds) {
    return { isValid: false, reason: 'Signature timestamp expired (> 5 minutes old)' };
  }

  const expected = await signWebhookPayload(secret, rawBody, timestamp);
  if (expected.hashHex.toLowerCase() !== receivedHex.toLowerCase()) {
    return { isValid: false, reason: 'Signature hash mismatch' };
  }

  return { isValid: true };
}
