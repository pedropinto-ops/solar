-- Combos/pacotes: preço fechado por N diárias, estadia+serviços, desconto por noites.

-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('CLOSED_PRICE', 'LOS_DISCOUNT');

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "PackageKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nights" INTEGER,
    "price" DECIMAL(10,2),
    "includedItems" TEXT[],
    "description" TEXT,
    "minNights" INTEGER,
    "discountPercent" DECIMAL(5,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_propertyId_idx" ON "packages"("propertyId");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
