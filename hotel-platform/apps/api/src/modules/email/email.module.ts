import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service.js';

/**
 * Global — qualquer módulo pode injetar EmailService sem importar.
 * Mesmo padrão do AuditModule.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
