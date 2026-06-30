import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente da API do Asaas (https://docs.asaas.com).
 *
 * Cobre os endpoints necessários para o MVP:
 *   - Criar cliente (customer)
 *   - Criar cobrança (payment) — Pix ou Cartão
 *   - Obter QR Code Pix
 *   - Reembolsar
 *
 * Em produção, o token vai por variável de ambiente. Sandbox tem URL
 * diferente. Webhooks são autenticados via header `asaas-access-token`.
 */

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  cpfCnpj: string;
  phone?: string;
}

export interface CreatePaymentParams {
  customerId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference?: string; // nosso ID interno
  installmentCount?: number;
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

export interface AsaasPixQrCode {
  encodedImage: string; // base64
  payload: string; // copia e cola
  expirationDate: string;
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.baseUrl = config.get('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3');
    this.apiKey = config.get('ASAAS_API_KEY', '');
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      this.logger.warn(
        '⚠️  ASAAS_API_KEY não configurado — chamadas ao Asaas vão falhar. ' +
          'Configure no .env para habilitar pagamentos.',
      );
    }
  }

  /**
   * Indica se o gateway está configurado.
   * Útil para o sistema decidir entre usar API real ou modo mock/manual.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.enabled) {
      throw new BadRequestException({
        errorCode: 'PAYMENT_GATEWAY_ERROR',
        title: 'Gateway de pagamento não configurado',
        detail:
          'Configure ASAAS_API_KEY no servidor. Em desenvolvimento, use sandbox.asaas.com.',
      });
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      accept: 'application/json',
      access_token: this.apiKey,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      this.logger.error(`Asaas ${method} ${path} → ${response.status}`, data);
      throw new BadRequestException({
        errorCode: 'PAYMENT_GATEWAY_ERROR',
        title: 'Erro no gateway de pagamento',
        detail:
          data?.errors?.[0]?.description ||
          data?.message ||
          `HTTP ${response.status}`,
        context: { status: response.status, asaasResponse: data },
      });
    }

    return data as T;
  }

  // ===========================================================
  //  CUSTOMER
  // ===========================================================

  async findOrCreateCustomer(params: {
    name: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
  }): Promise<AsaasCustomer> {
    // Busca por CPF/CNPJ
    const cleaned = params.cpfCnpj.replace(/\D/g, '');
    const list = await this.request<{ data: AsaasCustomer[] }>(
      'GET',
      `/customers?cpfCnpj=${cleaned}`,
    );
    if (list.data && list.data.length > 0) {
      return list.data[0]!;
    }
    // Cria
    return this.request<AsaasCustomer>('POST', '/customers', {
      name: params.name,
      cpfCnpj: cleaned,
      email: params.email,
      phone: params.phone,
    });
  }

  // ===========================================================
  //  PAYMENTS
  // ===========================================================

  async createPayment(params: CreatePaymentParams): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', '/payments', {
      customer: params.customerId,
      billingType: params.billingType,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
      installmentCount: params.installmentCount,
    });
  }

  /**
   * Recupera QR Code Pix de uma cobrança (Asaas só gera após criar Payment).
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
    return this.request<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`);
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('GET', `/payments/${paymentId}`);
  }

  async refund(paymentId: string, value?: number): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', `/payments/${paymentId}/refund`, {
      value, // omitir = reembolso total
    });
  }
}
