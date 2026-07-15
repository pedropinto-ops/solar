import { describe, it, expect } from 'vitest';
import { distributeAmountToNights } from './reservation.service.js';

const sum = (a: number[]) => Math.round(a.reduce((s, n) => s + n, 0) * 100) / 100;

describe('distributeAmountToNights — diárias fecham com o total (anti-mismatch de check-out)', () => {
  it('divisão exata: 600 em 3 noites → 200 cada', () => {
    expect(distributeAmountToNights(600, 3)).toEqual([200, 200, 200]);
  });

  it('valor que não divide redondo: soma continua exata ao centavo', () => {
    const parts = distributeAmountToNights(100, 3); // 33.34 + 33.33 + 33.33
    expect(sum(parts)).toBe(100);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
  });

  it('caso clássico do bug: total quebrado por 7 noites soma exatamente o total', () => {
    const total = 1000.01;
    const parts = distributeAmountToNights(total, 7);
    expect(parts).toHaveLength(7);
    expect(sum(parts)).toBe(total);
  });

  it('1 noite recebe o total inteiro', () => {
    expect(distributeAmountToNights(287.5, 1)).toEqual([287.5]);
  });

  it('0 noites → lista vazia (sem divisão por zero)', () => {
    expect(distributeAmountToNights(500, 0)).toEqual([]);
  });

  it('propriedade geral: para vários totais/noites, a soma sempre bate', () => {
    for (const total of [150, 299.99, 1234.56, 89.9, 4000]) {
      for (const nights of [1, 2, 3, 5, 7, 14, 30]) {
        expect(sum(distributeAmountToNights(total, nights))).toBe(
          Math.round(total * 100) / 100,
        );
      }
    }
  });
});
