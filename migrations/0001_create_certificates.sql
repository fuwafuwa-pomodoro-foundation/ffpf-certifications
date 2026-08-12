CREATE TABLE IF NOT EXISTS "Certificate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "issuedAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Certificate_createdAt_idx"
  ON "Certificate" ("createdAt" DESC);
