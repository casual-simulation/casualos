-- CreateTable
CREATE TABLE "OpenIdIdentity" (
    "provider" STRING NOT NULL,
    "subject" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenIdIdentity_pkey" PRIMARY KEY ("provider","subject")
);

-- CreateIndex
CREATE INDEX "OpenIdIdentity_userId_idx" ON "OpenIdIdentity"("userId");

-- AddForeignKey
ALTER TABLE "OpenIdIdentity" ADD CONSTRAINT "OpenIdIdentity_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
