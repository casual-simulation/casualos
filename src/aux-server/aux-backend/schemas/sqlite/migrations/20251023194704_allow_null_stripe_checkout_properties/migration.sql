-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuthCheckoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paid" BOOLEAN NOT NULL,
    "fulfilledAt" DECIMAL,
    "items" JSONB NOT NULL,
    "stripeStatus" TEXT,
    "stripePaymentStatus" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "invoiceId" TEXT,
    "userId" TEXT,
    "transactionId" TEXT,
    "transferIds" JSONB,
    "transfersPending" BOOLEAN,
    "shouldBeAutomaticallyFulfilled" BOOLEAN,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "AuthCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuthCheckoutSession" ("createdAt", "fulfilledAt", "id", "invoiceId", "items", "paid", "shouldBeAutomaticallyFulfilled", "stripeCheckoutSessionId", "stripePaymentStatus", "stripeStatus", "transactionId", "transferIds", "transfersPending", "updatedAt", "userId") SELECT "createdAt", "fulfilledAt", "id", "invoiceId", "items", "paid", "shouldBeAutomaticallyFulfilled", "stripeCheckoutSessionId", "stripePaymentStatus", "stripeStatus", "transactionId", "transferIds", "transfersPending", "updatedAt", "userId" FROM "AuthCheckoutSession";
DROP TABLE "AuthCheckoutSession";
ALTER TABLE "new_AuthCheckoutSession" RENAME TO "AuthCheckoutSession";
CREATE UNIQUE INDEX "AuthCheckoutSession_stripeCheckoutSessionId_key" ON "AuthCheckoutSession"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "AuthCheckoutSession_invoiceId_key" ON "AuthCheckoutSession"("invoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
