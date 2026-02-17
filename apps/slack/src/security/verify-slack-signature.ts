import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifySlackSignatureInput {
  signingSecret: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

function isTimestampFresh(timestampSeconds: number, nowSeconds: number, toleranceSeconds: number): boolean {
  const age = Math.abs(nowSeconds - timestampSeconds);
  return age <= toleranceSeconds;
}

export function verifySlackSignature(input: VerifySlackSignatureInput): boolean {
  if (!input.signature || !input.timestamp) {
    return false;
  }

  const timestampSeconds = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 60 * 5;

  if (!isTimestampFresh(timestampSeconds, nowSeconds, toleranceSeconds)) {
    return false;
  }

  const baseString = `v0:${input.timestamp}:${input.rawBody}`;
  const digest = createHmac("sha256", input.signingSecret).update(baseString).digest("hex");
  const expected = `v0=${digest}`;

  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(input.signature, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
