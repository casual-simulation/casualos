-- CreateTable
CREATE TABLE "public"."BillingJobHistory" (
    "id" UUID NOT NULL,
    "timeMs" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingJobHistory_pkey" PRIMARY KEY ("id")
);
