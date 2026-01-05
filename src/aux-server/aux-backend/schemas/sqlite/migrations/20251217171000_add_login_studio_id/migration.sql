-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "avatarPortraitUrl" TEXT,
    "avatarUrl" TEXT,
    "allSessionRevokeTime" DECIMAL,
    "currentLoginRequestId" TEXT,
    "currentWebAuthnChallenge" TEXT,
    "banTime" DECIMAL,
    "banReason" TEXT,
    "privoServiceId" TEXT,
    "privoParentServiceId" TEXT,
    "privoConsentUrl" TEXT,
    "subscriptionInfoId" TEXT,
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionPeriodStart" DECIMAL,
    "subscriptionPeriodEnd" DECIMAL,
    "allowPublishData" BOOLEAN,
    "allowPublicData" BOOLEAN,
    "allowAI" BOOLEAN,
    "allowPublicInsts" BOOLEAN,
    "role" TEXT,
    "loginStudioId" TEXT,
    "stripeAccountId" TEXT,
    "stripeAccountRequirementsStatus" TEXT,
    "stripeAccountStatus" TEXT,
    "requestedRate" INTEGER,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "User_currentLoginRequestId_fkey" FOREIGN KEY ("currentLoginRequestId") REFERENCES "LoginRequest" ("requestId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_subscriptionInfoId_fkey" FOREIGN KEY ("subscriptionInfoId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_loginStudioId_fkey" FOREIGN KEY ("loginStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("allSessionRevokeTime", "allowAI", "allowPublicData", "allowPublicInsts", "allowPublishData", "avatarPortraitUrl", "avatarUrl", "banReason", "banTime", "createdAt", "currentLoginRequestId", "currentWebAuthnChallenge", "email", "id", "name", "phoneNumber", "privoConsentUrl", "privoParentServiceId", "privoServiceId", "requestedRate", "role", "stripeAccountId", "stripeAccountRequirementsStatus", "stripeAccountStatus", "stripeCustomerId", "subscriptionId", "subscriptionInfoId", "subscriptionPeriodEnd", "subscriptionPeriodStart", "subscriptionStatus", "updatedAt") SELECT "allSessionRevokeTime", "allowAI", "allowPublicData", "allowPublicInsts", "allowPublishData", "avatarPortraitUrl", "avatarUrl", "banReason", "banTime", "createdAt", "currentLoginRequestId", "currentWebAuthnChallenge", "email", "id", "name", "phoneNumber", "privoConsentUrl", "privoParentServiceId", "privoServiceId", "requestedRate", "role", "stripeAccountId", "stripeAccountRequirementsStatus", "stripeAccountStatus", "stripeCustomerId", "subscriptionId", "subscriptionInfoId", "subscriptionPeriodEnd", "subscriptionPeriodStart", "subscriptionStatus", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_currentLoginRequestId_key" ON "User"("currentLoginRequestId");
CREATE UNIQUE INDEX "User_privoServiceId_key" ON "User"("privoServiceId");
CREATE UNIQUE INDEX "User_subscriptionInfoId_key" ON "User"("subscriptionInfoId");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
CREATE UNIQUE INDEX "User_email_loginStudioId_key" ON "User"("email", "loginStudioId");
CREATE UNIQUE INDEX "User_phoneNumber_loginStudioId_key" ON "User"("phoneNumber", "loginStudioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
