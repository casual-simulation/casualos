-- AlterTable
ALTER TABLE "public"."AuthCheckoutSession" ALTER COLUMN "stripeStatus" DROP NOT NULL;
ALTER TABLE "public"."AuthCheckoutSession" ALTER COLUMN "stripePaymentStatus" DROP NOT NULL;
ALTER TABLE "public"."AuthCheckoutSession" ALTER COLUMN "stripeCheckoutSessionId" DROP NOT NULL;
