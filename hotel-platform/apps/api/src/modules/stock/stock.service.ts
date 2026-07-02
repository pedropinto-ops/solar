import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { Prisma } from '@prisma/client';
import type {
  CreateProductInput,
  UpdateProductInput,
  StockMoveInput,
} from '@hotel/shared/schemas';

const P = Prisma;

/**
 * Almoxarifado — controle de bens/insumos do hotel.
 * Opera sobre o depósito central (StockLocation WAREHOUSE); é criado
 * automaticamente se não existir.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getWarehouse(propertyId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const existing = await db.stockLocation.findFirst({
      where: { propertyId, type: 'WAREHOUSE', active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return db.stockLocation.create({
      data: { propertyId, name: 'Almoxarifado', type: 'WAREHOUSE' },
    });
  }

  /** Lista produtos com a posição de estoque do almoxarifado. */
  async listProducts(propertyId: string) {
    const warehouse = await this.getWarehouse(propertyId);
    const products = await this.prisma.product.findMany({
      where: { propertyId, active: true },
      include: {
        stockItems: { where: { locationId: warehouse.id } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return products.map((p) => {
      const stock = p.stockItems[0];
      const quantity = stock ? Number(stock.quantity) : 0;
      const minLevel = stock?.minLevel != null ? Number(stock.minLevel) : null;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        unitMeasure: p.unitMeasure,
        unitPrice: Number(p.unitPrice),
        unitCost: p.unitCost != null ? Number(p.unitCost) : null,
        quantity,
        minLevel,
        low: minLevel != null && quantity <= minLevel,
      };
    });
  }

  async createProduct(params: {
    propertyId: string;
    userId: string;
    data: CreateProductInput;
  }) {
    const { propertyId, userId, data } = params;

    const sku =
      data.sku?.trim().toUpperCase() ||
      data.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toUpperCase()
        .slice(0, 30);

    return this.prisma.$transaction(async (tx) => {
      const warehouse = await this.getWarehouse(propertyId, tx);

      const dup = await tx.product.findFirst({ where: { propertyId, sku } });
      if (dup) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Já existe um produto com o código "${sku}"`,
        });
      }

      const product = await tx.product.create({
        data: {
          propertyId,
          sku,
          name: data.name.trim(),
          category: data.category,
          unitMeasure: data.unitMeasure,
          unitPrice: new P.Decimal(data.unitPrice),
          unitCost: data.unitCost != null ? new P.Decimal(data.unitCost) : null,
        },
      });

      await tx.stock.create({
        data: {
          productId: product.id,
          locationId: warehouse.id,
          quantity: new P.Decimal(data.initialQuantity),
          minLevel: data.minLevel != null ? new P.Decimal(data.minLevel) : null,
        },
      });

      if (data.initialQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: warehouse.id,
            type: 'IN',
            quantity: new P.Decimal(data.initialQuantity),
            reason: 'Estoque inicial (cadastro)',
            userId,
          },
        });
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'stock.product_created',
          entityType: 'Product',
          entityId: product.id,
          changes: { sku, name: product.name },
        },
        tx,
      );

      return product;
    });
  }

  async updateProduct(params: {
    propertyId: string;
    userId: string;
    productId: string;
    data: UpdateProductInput;
  }) {
    const { propertyId, userId, productId, data } = params;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, propertyId },
      });
      if (!product) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Produto não encontrado',
        });
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.unitMeasure !== undefined ? { unitMeasure: data.unitMeasure } : {}),
          ...(data.unitPrice !== undefined
            ? { unitPrice: new P.Decimal(data.unitPrice) }
            : {}),
          ...(data.unitCost !== undefined
            ? { unitCost: data.unitCost != null ? new P.Decimal(data.unitCost) : null }
            : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });

      if (data.minLevel !== undefined) {
        const warehouse = await this.getWarehouse(propertyId, tx);
        await tx.stock.upsert({
          where: {
            productId_locationId: { productId, locationId: warehouse.id },
          },
          update: {
            minLevel: data.minLevel != null ? new P.Decimal(data.minLevel) : null,
          },
          create: {
            productId,
            locationId: warehouse.id,
            quantity: new P.Decimal(0),
            minLevel: data.minLevel != null ? new P.Decimal(data.minLevel) : null,
          },
        });
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'stock.product_updated',
          entityType: 'Product',
          entityId: productId,
          changes: data as Record<string, unknown>,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Movimenta o estoque do almoxarifado.
   * IN: soma. OUT/LOSS: subtrai (valida saldo). ADJUSTMENT: define a
   * quantidade contada (grava o delta como movimento).
   */
  async move(params: { propertyId: string; userId: string; data: StockMoveInput }) {
    const { propertyId, userId, data } = params;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: data.productId, propertyId },
      });
      if (!product) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Produto não encontrado',
        });
      }

      const warehouse = await this.getWarehouse(propertyId, tx);
      const stock = await tx.stock.upsert({
        where: {
          productId_locationId: {
            productId: data.productId,
            locationId: warehouse.id,
          },
        },
        update: {},
        create: {
          productId: data.productId,
          locationId: warehouse.id,
          quantity: new P.Decimal(0),
        },
      });

      const current = Number(stock.quantity);
      let delta: number;

      switch (data.type) {
        case 'IN':
          if (data.quantity <= 0) {
            throw new BadRequestException({
              errorCode: 'VALIDATION_ERROR',
              title: 'Quantidade deve ser maior que zero',
            });
          }
          delta = data.quantity;
          break;
        case 'OUT':
        case 'LOSS':
          if (data.quantity <= 0) {
            throw new BadRequestException({
              errorCode: 'VALIDATION_ERROR',
              title: 'Quantidade deve ser maior que zero',
            });
          }
          if (data.quantity > current) {
            throw new BadRequestException({
              errorCode: 'VALIDATION_ERROR',
              title: `Estoque insuficiente (disponível: ${current})`,
            });
          }
          delta = -data.quantity;
          break;
        case 'ADJUSTMENT':
          delta = data.quantity - current; // nova contagem
          break;
      }

      const updated = await tx.stock.update({
        where: { id: stock.id },
        data: {
          quantity: new P.Decimal(current + delta),
          ...(data.type === 'ADJUSTMENT' ? { lastCountedAt: new Date() } : {}),
        },
      });

      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: data.productId,
            locationId: warehouse.id,
            type: data.type,
            quantity: new P.Decimal(delta),
            reason: data.reason,
            userId,
          },
        });
      }

      return { productId: data.productId, quantity: Number(updated.quantity) };
    });
  }

  /** Últimas movimentações do almoxarifado. */
  async listMovements(propertyId: string, limit = 30) {
    const warehouse = await this.getWarehouse(propertyId);
    const movements = await this.prisma.stockMovement.findMany({
      where: { locationId: warehouse.id },
      include: { product: { select: { name: true, unitMeasure: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const userIds = [...new Set(movements.map((m) => m.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      reason: m.reason,
      createdAt: m.createdAt,
      product: m.product,
      userName: m.userId ? (userMap.get(m.userId) ?? null) : null,
    }));
  }
}
