-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "mandateActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mandateLimitMonthly" INTEGER NOT NULL DEFAULT 2000000,
ADD COLUMN     "mandateLimitSingle" INTEGER NOT NULL DEFAULT 500000,
ADD COLUMN     "mandateSpentMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "razorpayMandateToken" TEXT;

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);
