import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { SchedulingModule } from './common/scheduling/scheduling.module.js';
import { HealthController } from './common/health/health.controller.js';
import { JwtAuthGuard, RolesGuard } from './modules/auth/auth.guards.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PropertyModule } from './modules/property/property.module.js';
import { RoomModule } from './modules/room/room.module.js';
import { ReservationModule } from './modules/reservation/reservation.module.js';
import { GuestModule } from './modules/guest/guest.module.js';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module.js';
import { UserModule } from './modules/user/user.module.js';
import { PaymentModule } from './modules/payment/payment.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { StockModule } from './modules/stock/stock.module.js';
import { ReportModule } from './modules/report/report.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { CompanyModule } from './modules/company/company.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Rate limiting — protege contra abuso (DDoS, scraping)
    // Limites globais; o endpoint público de reserva tem override mais restritivo.
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,     // 1s
        limit: 10,     // 10 req/s por IP
      },
      {
        name: 'medium',
        ttl: 60_000,   // 1 min
        limit: 100,    // 100 req/min por IP
      },
      {
        name: 'long',
        ttl: 3_600_000, // 1h
        limit: 1000,    // 1000 req/h por IP
      },
    ]),
    PrismaModule,
    AuditModule,
    EmailModule,
    SchedulingModule,
    AuthModule,
    PropertyModule,
    HousekeepingModule,
    RoomModule,
    GuestModule,
    ReservationModule,
    UserModule,
    PaymentModule,
    PublicModule,
    StockModule,
    ReportModule,
    PricingModule,
    CompanyModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: Jwt (autentica, popula user) antes do Roles (checa perfil).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
