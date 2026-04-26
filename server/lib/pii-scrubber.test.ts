import { describe, expect, test } from "bun:test";
import { scrubPII } from "./pii-scrubber";

describe("pii-scrubber", () => {
  test("should scrub email addresses", () => {
    const input = "Contact me at user@example.com for more info.";
    const expected = "Contact me at [EMAIL_REMOVED] for more info.";
    expect(scrubPII(input)).toBe(expected);
  });

  test("should scrub phone numbers", () => {
    const input = "Call +49 170 1234567 for reservations.";
    const expected = "Call [PHONE_REMOVED] for reservations.";
    expect(scrubPII(input)).toBe(expected);
  });

  test("should leave safe text unmodified", () => {
    const input = "We have 5 items in stock today.";
    expect(scrubPII(input)).toBe(input);
  });
});
