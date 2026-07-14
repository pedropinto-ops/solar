-- Precificação por data: regras de tarifa por período (temporada/feriado/evento).

-- CreateEnum
CREATE TYPE "RateAdjustType" AS ENUM ('ABSOLUTE', 'PERCENT');

-- CreateTable
CREATE TABLE "rate_periods" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "adjustType" "RateAdjustType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_periods_propertyId_startDate_endDate_idx" ON "rate_periods"("propertyId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "rate_periods" ADD CONSTRAINT "rate_periods_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
