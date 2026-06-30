-- =============================================================
--  Migration inicial - Hotel Platform
--  Combina: extensoes + tabelas (do schema) + constraints.
-- =============================================================

-- ---- EXTENSOES ----
-- Extensões necessárias para o schema da plataforma
-- Executado automaticamente quando o container Postgres inicia pela primeira vez

-- btree_gist necessário para EXCLUDE constraint anti-overbooking
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pgcrypto para gerar UUIDs aleatórios e funções de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- citext para campos case-insensitive (e-mails, etc) — opcional
CREATE EXTENSION IF NOT EXISTS citext;

-- unaccent para buscas tolerantes a acento (busca de hóspede por nome)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- pg_trgm para busca fuzzy (LIKE com índice rápido)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ---- TABELAS / ENUMS / INDICES (gerado do schema.prisma) ----
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER', 'READONLY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECTION', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CPF', 'RG', 'CNH', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "TravelPurpose" AS ENUM ('LEISURE', 'BUSINESS', 'EVENT', 'HEALTH', 'EDUCATION', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "TransportMeans" AS ENUM ('OWN_CAR', 'RENTED_CAR', 'BUS', 'PLANE', 'TRAIN', 'BOAT', 'MOTORCYCLE', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('DEPOSIT_BALANCE', 'POSTPAID_CORPORATE', 'FULL_PREPAID', 'GUARANTEE_CARD');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('DIRECT', 'WALK_IN', 'PHONE', 'WHATSAPP', 'EMAIL', 'RECEPTION', 'BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CleaningType" AS ENUM ('CHECKOUT', 'DAILY', 'TURNDOWN', 'DEEP_CLEAN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CleaningStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MINIBAR', 'RESTAURANT', 'BAR', 'ROOM_SERVICE', 'LAUNDRY', 'SPA', 'EXTRA_SERVICE', 'AMENITY');

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('MINIBAR_ROOM', 'WAREHOUSE', 'POS');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOSS');

-- CreateEnum
CREATE TYPE "ChargeItemType" AS ENUM ('ROOM_NIGHT', 'CONSUMPTION', 'FEE', 'ADJUSTMENT', 'COURTESY', 'REFUND');

-- CreateEnum
CREATE TYPE "FiscalDocType" AS ENUM ('NFSE', 'NFE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "FiscalDocStatus" AS ENUM ('PENDING', 'PROCESSING', 'ISSUED', 'CANCELLED', 'REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "cnpj" TEXT,
    "cadastur" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressNeighborhood" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "addressCountry" TEXT NOT NULL DEFAULT 'BR',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "bookingSlug" TEXT NOT NULL,
    "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fiscalProvider" TEXT,
    "fiscalApiToken" TEXT,
    "fiscalServiceCode" TEXT,
    "fiscalCnae" TEXT,
    "fiscalIssRate" DECIMAL(5,2),
    "fiscalIssWithheld" BOOLEAN NOT NULL DEFAULT false,
    "fiscalCertExpiresAt" TIMESTAMP(3),
    "paymentPolicies" JSONB,
    "cancellationPolicy" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
    "maxAdults" INTEGER NOT NULL DEFAULT 2,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "bedConfig" TEXT,
    "sizeSqm" DOUBLE PRECISION,
    "amenities" TEXT[],
    "photos" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_status_logs" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "previousStatus" "RoomStatus",
    "newStatus" "RoomStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentIssuer" TEXT,
    "documentIssuedAt" DATE,
    "birthDate" DATE,
    "gender" "Gender",
    "nationality" TEXT NOT NULL DEFAULT 'BR',
    "occupation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressNeighborhood" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "addressCountry" TEXT NOT NULL DEFAULT 'BR',
    "travelOrigin" TEXT,
    "travelDestination" TEXT,
    "travelPurpose" "TravelPurpose",
    "transportMeans" "TransportMeans",
    "preferences" JSONB,
    "tags" TEXT[],
    "internalNotes" TEXT,
    "companyId" TEXT,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "consentDataAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_documents" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "primaryGuestId" TEXT,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "billingMode" "BillingMode" NOT NULL DEFAULT 'DEPOSIT_BALANCE',
    "depositPercent" INTEGER DEFAULT 30,
    "companyId" TEXT,
    "invoiceId" TEXT,
    "corporatePO" TEXT,
    "source" "ReservationSource" NOT NULL DEFAULT 'DIRECT',
    "sourceDetails" TEXT,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "guestNotes" TEXT,
    "internalNotes" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_guests" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayProvider" TEXT,
    "gatewayId" TEXT,
    "gatewayUrl" TEXT,
    "pixQrCode" TEXT,
    "pixCopyPaste" TEXT,
    "pixExpiresAt" TIMESTAMP(3),
    "cardLastDigits" TEXT,
    "cardBrand" TEXT,
    "installments" INTEGER DEFAULT 1,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundedAmount" DECIMAL(10,2),
    "refundReason" TEXT,
    "notes" TEXT,
    "webhookPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_tasks" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "CleaningType" NOT NULL DEFAULT 'CHECKOUT',
    "status" "CleaningStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "inspectedById" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "issuesReported" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactName" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressNeighborhood" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "addressCountry" TEXT NOT NULL DEFAULT 'BR',
    "defaultRateOverride" DECIMAL(10,2),
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "billingDay" INTEGER,
    "creditLimit" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "consumptions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueDate" DATE,
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2),
    "unitMeasure" TEXT NOT NULL DEFAULT 'UN',
    "fiscalCode" TEXT,
    "ncm" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StockLocationType" NOT NULL,
    "roomId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "minLevel" DECIMAL(10,3),
    "maxLevel" DECIMAL(10,3),
    "lastCountedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "reason" TEXT,
    "chargeItemId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_items" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" "ChargeItemType" NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "registeredById" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "notes" TEXT,

    CONSTRAINT "charge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_documents" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "FiscalDocType" NOT NULL DEFAULT 'NFSE',
    "status" "FiscalDocStatus" NOT NULL DEFAULT 'PENDING',
    "reservationId" TEXT,
    "invoiceId" TEXT,
    "number" TEXT,
    "series" TEXT,
    "verificationCode" TEXT,
    "rpsNumber" TEXT,
    "serviceAmount" DECIMAL(12,2) NOT NULL,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "issAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issRate" DECIMAL(5,2) NOT NULL,
    "taxpayerName" TEXT NOT NULL,
    "taxpayerDocument" TEXT NOT NULL,
    "taxpayerEmail" TEXT,
    "providerRef" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_cnpj_key" ON "properties"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "properties_bookingSlug_key" ON "properties"("bookingSlug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_propertyId_idx" ON "users"("propertyId");

-- CreateIndex
CREATE INDEX "room_types_propertyId_idx" ON "room_types"("propertyId");

-- CreateIndex
CREATE INDEX "rooms_propertyId_status_idx" ON "rooms"("propertyId", "status");

-- CreateIndex
CREATE INDEX "rooms_roomTypeId_idx" ON "rooms"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_propertyId_number_key" ON "rooms"("propertyId", "number");

-- CreateIndex
CREATE INDEX "room_status_logs_roomId_createdAt_idx" ON "room_status_logs"("roomId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "guests_propertyId_fullName_idx" ON "guests"("propertyId", "fullName");

-- CreateIndex
CREATE INDEX "guests_propertyId_email_idx" ON "guests"("propertyId", "email");

-- CreateIndex
CREATE INDEX "guests_propertyId_phone_idx" ON "guests"("propertyId", "phone");

-- CreateIndex
CREATE INDEX "guests_companyId_idx" ON "guests"("companyId");

-- CreateIndex
CREATE INDEX "guests_deletedAt_idx" ON "guests"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "guests_propertyId_documentNumber_key" ON "guests"("propertyId", "documentNumber");

-- CreateIndex
CREATE INDEX "guest_documents_guestId_idx" ON "guest_documents"("guestId");

-- CreateIndex
CREATE INDEX "reservations_propertyId_status_idx" ON "reservations"("propertyId", "status");

-- CreateIndex
CREATE INDEX "reservations_propertyId_checkInDate_idx" ON "reservations"("propertyId", "checkInDate");

-- CreateIndex
CREATE INDEX "reservations_propertyId_checkOutDate_idx" ON "reservations"("propertyId", "checkOutDate");

-- CreateIndex
CREATE INDEX "reservations_roomId_checkInDate_checkOutDate_idx" ON "reservations"("roomId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "reservations_primaryGuestId_idx" ON "reservations"("primaryGuestId");

-- CreateIndex
CREATE INDEX "reservations_companyId_status_idx" ON "reservations"("companyId", "status");

-- CreateIndex
CREATE INDEX "reservations_invoiceId_idx" ON "reservations"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_propertyId_code_key" ON "reservations"("propertyId", "code");

-- CreateIndex
CREATE INDEX "reservation_guests_guestId_idx" ON "reservation_guests"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_guests_reservationId_guestId_key" ON "reservation_guests"("reservationId", "guestId");

-- CreateIndex
CREATE INDEX "payments_propertyId_status_idx" ON "payments"("propertyId", "status");

-- CreateIndex
CREATE INDEX "payments_reservationId_idx" ON "payments"("reservationId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_gatewayId_idx" ON "payments"("gatewayId");

-- CreateIndex
CREATE INDEX "cleaning_tasks_propertyId_status_idx" ON "cleaning_tasks"("propertyId", "status");

-- CreateIndex
CREATE INDEX "cleaning_tasks_assignedToId_status_idx" ON "cleaning_tasks"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "cleaning_tasks_roomId_idx" ON "cleaning_tasks"("roomId");

-- CreateIndex
CREATE INDEX "cleaning_tasks_scheduledFor_idx" ON "cleaning_tasks"("scheduledFor");

-- CreateIndex
CREATE INDEX "audit_logs_propertyId_createdAt_idx" ON "audit_logs"("propertyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "companies_propertyId_active_idx" ON "companies"("propertyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "companies_propertyId_cnpj_key" ON "companies"("propertyId", "cnpj");

-- CreateIndex
CREATE INDEX "invoices_propertyId_status_idx" ON "invoices"("propertyId", "status");

-- CreateIndex
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_propertyId_number_key" ON "invoices"("propertyId", "number");

-- CreateIndex
CREATE INDEX "products_propertyId_category_active_idx" ON "products"("propertyId", "category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "products_propertyId_sku_key" ON "products"("propertyId", "sku");

-- CreateIndex
CREATE INDEX "stock_locations_propertyId_type_idx" ON "stock_locations"("propertyId", "type");

-- CreateIndex
CREATE INDEX "stock_locations_roomId_idx" ON "stock_locations"("roomId");

-- CreateIndex
CREATE INDEX "stocks_locationId_idx" ON "stocks"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_productId_locationId_key" ON "stocks"("productId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_chargeItemId_key" ON "stock_movements"("chargeItemId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_locationId_createdAt_idx" ON "stock_movements"("locationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "charge_items_propertyId_registeredAt_idx" ON "charge_items"("propertyId", "registeredAt" DESC);

-- CreateIndex
CREATE INDEX "charge_items_reservationId_idx" ON "charge_items"("reservationId");

-- CreateIndex
CREATE INDEX "charge_items_productId_idx" ON "charge_items"("productId");

-- CreateIndex
CREATE INDEX "fiscal_documents_propertyId_status_idx" ON "fiscal_documents"("propertyId", "status");

-- CreateIndex
CREATE INDEX "fiscal_documents_propertyId_issuedAt_idx" ON "fiscal_documents"("propertyId", "issuedAt" DESC);

-- CreateIndex
CREATE INDEX "fiscal_documents_reservationId_idx" ON "fiscal_documents"("reservationId");

-- CreateIndex
CREATE INDEX "fiscal_documents_invoiceId_idx" ON "fiscal_documents"("invoiceId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_primaryGuestId_fkey" FOREIGN KEY ("primaryGuestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_chargeItemId_fkey" FOREIGN KEY ("chargeItemId") REFERENCES "charge_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_items" ADD CONSTRAINT "charge_items_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_items" ADD CONSTRAINT "charge_items_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_items" ADD CONSTRAINT "charge_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---- CONSTRAINTS ADICIONAIS (anti-overbooking, triggers, checks) ----
-- =============================================================
--  CONSTRAINTS ADICIONAIS — Hotel Platform
-- =============================================================
--  Aplicar APÓS criar as tabelas (prisma db push / migrate).
--  Adiciona regras que o Prisma não expressa nativamente.
--
--  Como aplicar:
--    pnpm exec prisma db execute --file prisma/migrations/post-init.sql --schema prisma/schema.prisma
--
--  IMPORTANTE: as colunas são camelCase (sem @map no schema), então
--  precisam de aspas duplas no SQL ("roomId", "checkInDate", ...).
--  Requer extensões btree_gist e pg_trgm (ver scripts/init-db.sql).
-- =============================================================

-- -------------------------------------------------------------
--  ANTI-OVERBOOKING (Exclusion Constraint)
-- -------------------------------------------------------------
--  Impede no nível do BANCO que duas reservas CONFIRMED ou
--  CHECKED_IN ocupem o mesmo quarto em datas sobrepostas.
--  Última linha de defesa: mesmo que um bug no código permita
--  criar a reserva, o Postgres recusa.

ALTER TABLE reservations
ADD CONSTRAINT reservations_no_overbooking
EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
)
WHERE (
    "roomId" IS NOT NULL
    AND status IN ('CONFIRMED', 'CHECKED_IN')
);

COMMENT ON CONSTRAINT reservations_no_overbooking ON reservations IS
    'Impede sobreposição de datas para o mesmo quarto em reservas confirmadas. Requer extensão btree_gist.';

-- -------------------------------------------------------------
--  COMPUTED COLUMN: nights
-- -------------------------------------------------------------
--  Garante que "nights" é sempre coerente com as datas.
--  (Prisma não suporta GENERATED ALWAYS AS, então fazemos via trigger.)

CREATE OR REPLACE FUNCTION reservations_compute_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW."nights" := NEW."checkOutDate" - NEW."checkInDate";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservations_set_nights ON reservations;
CREATE TRIGGER reservations_set_nights
    BEFORE INSERT OR UPDATE OF "checkInDate", "checkOutDate" ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION reservations_compute_nights();

-- -------------------------------------------------------------
--  VALIDATIONS via CHECK
-- -------------------------------------------------------------

-- check_out > check_in (estadia mínima 1 noite)
ALTER TABLE reservations
ADD CONSTRAINT reservations_dates_valid
CHECK ("checkOutDate" > "checkInDate");

-- adults >= 1
ALTER TABLE reservations
ADD CONSTRAINT reservations_adults_min
CHECK (adults >= 1);

-- paidAmount nunca negativo
ALTER TABLE reservations
ADD CONSTRAINT reservations_paid_nonneg
CHECK ("paidAmount" >= 0);

-- depositPercent entre 0 e 100
ALTER TABLE reservations
ADD CONSTRAINT reservations_deposit_pct_range
CHECK ("depositPercent" IS NULL OR ("depositPercent" >= 0 AND "depositPercent" <= 100));

-- -------------------------------------------------------------
--  PAYMENT: ou tem reservation OU tem invoice (exatamente um)
-- -------------------------------------------------------------
ALTER TABLE payments
ADD CONSTRAINT payments_target_xor
CHECK (
    ("reservationId" IS NOT NULL AND "invoiceId" IS NULL)
    OR
    ("reservationId" IS NULL AND "invoiceId" IS NOT NULL)
);

-- -------------------------------------------------------------
--  ÍNDICE DE BUSCA POR NOME (trigram, tolerante a typo/acento)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS guests_full_name_trgm
    ON guests USING gin ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS reservations_code_trgm
    ON reservations USING gin (code gin_trgm_ops);

-- -------------------------------------------------------------
--  ÍNDICE PARCIAL: reservas ativas (consulta de disponibilidade)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reservations_active_lookup
    ON reservations ("propertyId", "roomId", "checkInDate", "checkOutDate")
    WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'PENDING');
