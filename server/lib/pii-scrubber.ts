/**
 * Lightweight, pure-regex PII scrubber.
 * Strips out sensitive information before sending context to the LLM.
 */

const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const IBAN_REGEX = /[A-Z]{2}\d{2}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{4}[ \-]?\d{0,2}/g;
const GERMAN_ZIP_REGEX = /\b([0-9]{5})\b/g;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_REGEX = /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g;

export function scrubPII(text: string): string {
  if (!text) return text;
  
  return text
    .replace(EMAIL_REGEX, '[EMAIL_REMOVED]')
    .replace(PHONE_REGEX, '[PHONE_REMOVED]')
    .replace(IBAN_REGEX, '[IBAN_REMOVED]')
    .replace(IPV4_REGEX, '[IP_REMOVED]')
    .replace(IPV6_REGEX, '[IP_REMOVED]');
}
