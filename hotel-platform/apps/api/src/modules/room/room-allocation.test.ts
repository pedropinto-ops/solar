import { describe, it, expect } from 'vitest';
import { selectRoomsByCapacity, allocateByCapacity } from './room.service.js';

/** Cada quarto tem uma capacidade real (maxOccupancy). */
const rooms = (...caps: number[]) =>
  caps.map((c, i) => ({ id: `q${i}`, maxOccupancy: c }));

describe('selectRoomsByCapacity — alocação automática de quartos', () => {
  it('escolhe o MENOR quarto único que caiba o grupo (não desperdiça quarto grande)', () => {
    const chosen = selectRoomsByCapacity(rooms(2, 3, 4), 2);
    expect(chosen).not.toBeNull();
    expect(chosen!.map((r) => r.maxOccupancy)).toEqual([2]);
  });

  it('usa quarto maior quando o menor não cabe', () => {
    const chosen = selectRoomsByCapacity(rooms(2, 3, 4), 4);
    expect(chosen!.map((r) => r.maxOccupancy)).toEqual([4]);
  });

  it('combina quartos (maiores primeiro) quando nenhum único cabe', () => {
    const chosen = selectRoomsByCapacity(rooms(2, 3, 4), 6);
    expect(chosen).not.toBeNull();
    const total = chosen!.reduce((s, r) => s + r.maxOccupancy, 0);
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it('não repete o mesmo quarto físico numa combinação', () => {
    const chosen = selectRoomsByCapacity(rooms(2, 2, 2), 5);
    expect(chosen).not.toBeNull();
    const ids = chosen!.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('retorna null quando a capacidade total é insuficiente', () => {
    expect(selectRoomsByCapacity(rooms(2, 3), 10)).toBeNull();
  });

  it('retorna null para grupo vazio ou sem quartos', () => {
    expect(selectRoomsByCapacity(rooms(2, 3), 0)).toBeNull();
    expect(selectRoomsByCapacity([], 2)).toBeNull();
  });
});

describe('allocateByCapacity — variante só com capacidades', () => {
  it('devolve as capacidades escolhidas', () => {
    expect(allocateByCapacity([2, 3, 4], 2)).toEqual([2]);
  });
  it('null quando não cabe', () => {
    expect(allocateByCapacity([2, 2], 10)).toBeNull();
  });
});
