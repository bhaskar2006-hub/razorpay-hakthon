-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('HUMAN', 'AI_AGENT', 'AI_BUYER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'HUMAN';
