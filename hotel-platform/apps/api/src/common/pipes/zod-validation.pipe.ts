import { PipeTransform, BadRequestException, Injectable } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Pipe que valida o body com um schema Zod do @hotel/shared.
 *
 * Uso:
 *   @Post('login')
 *   login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput) {...}
 */
@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.flatten();
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: 'Dados inválidos',
        status: 400,
        context: {
          fieldErrors: errors.fieldErrors,
          formErrors: errors.formErrors,
        },
      });
    }
    return result.data;
  }
}
