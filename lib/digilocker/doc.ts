import { createHmac, timingSafeEqual } from "crypto";

/**
 * DigiLocker "Issued Documents" pull contract (demo sandbox, real shape).
 *
 * In production DigiLocker calls the issuer's pull URI with an HMAC-signed
 * request and expects a PullURIResponse XML carrying the document. We implement
 * that exact contract so production is a config swap, not a rewrite — but the
 * document we return embeds the HireProof credential JWS, so it stays
 * offline-verifiable (did:web) even from inside DigiLocker.
 */
export const DOC_TYPE = "HPCRD"; // HireProof Credential

/** HMAC-SHA256 over the raw request body — DigiLocker's request-signing scheme. */
export function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyHmac(body: string, secret: string, provided: string | null | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(hmacSign(body, secret));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string
  );
}

export interface DocPayload {
  docType: string;
  digiLockerId: string;
  issuer: string;
  credentialId: string;
  issuedAt: string;
  expiresAt: string;
  score: number;
  verifyUrl: string;
  token: string; // the credential JWS — keeps the doc verifiable inside DigiLocker
}

/** Build a DigiLocker PullURIResponse with the credential embedded as base64
 *  DocData. Returns both the XML (the wire contract) and the decoded payload. */
export function buildDocDetails(
  p: DocPayload,
  txn: string,
  ts: string
): { xml: string; docData: string; payload: DocPayload } {
  const docData = Buffer.from(JSON.stringify(p)).toString("base64");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PullURIResponse>
  <ResponseStatus Status="1" ts="${escapeXml(ts)}" txn="${escapeXml(txn)}"/>
  <DocDetails>
    <DocContent>
      <DocType>${escapeXml(p.docType)}</DocType>
      <DigiLockerId>${escapeXml(p.digiLockerId)}</DigiLockerId>
      <Issuer>${escapeXml(p.issuer)}</Issuer>
      <DocData>${docData}</DocData>
    </DocContent>
  </DocDetails>
</PullURIResponse>`;
  return { xml, docData, payload: p };
}

/** A "no document found" PullURIResponse (Status=0), per the contract. */
export function notFoundResponse(txn: string, ts: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PullURIResponse>
  <ResponseStatus Status="0" ts="${escapeXml(ts)}" txn="${escapeXml(txn)}"/>
</PullURIResponse>`;
}
