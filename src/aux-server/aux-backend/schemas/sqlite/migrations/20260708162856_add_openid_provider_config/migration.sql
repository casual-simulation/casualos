-- CreateTable
CREATE TABLE "OpenIdIdentity" (
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,

    PRIMARY KEY ("provider", "subject"),
    CONSTRAINT "OpenIdIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OpenIdIdentity_userId_idx" ON "OpenIdIdentity"("userId");
