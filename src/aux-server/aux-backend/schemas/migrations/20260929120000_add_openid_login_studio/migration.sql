-- AlterTable
ALTER TABLE "public"."OpenIDLoginRequest" ADD COLUMN     "loginStudioId" STRING;

-- AlterTable
ALTER TABLE "public"."OpenIdIdentity" ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "public"."OpenIdIdentity" ADD COLUMN     "loginStudioId" STRING;

-- AlterPrimaryKey
ALTER TABLE "public"."OpenIdIdentity" ALTER PRIMARY KEY USING COLUMNS ("id");

-- CreateIndex
CREATE UNIQUE INDEX "OpenIdIdentity_provider_subject_loginStudioId_key" ON "public"."OpenIdIdentity"("provider", "subject", "loginStudioId");

