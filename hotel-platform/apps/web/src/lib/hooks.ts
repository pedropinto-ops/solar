'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-client';

// =========================================
//  Tipos básicos
// =========================================

export interface Reservation {
  id: string;
  code: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  paidAmount: string;
  dailyRate: string;
  billingMode: string;
  source: string;
  guestNotes?: string | null;
  internalNotes?: string | null;
  primaryGuest: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    tags: string[];
  } | null;
  roomType: { id: string; name: string };
  room: { id: string; number: string } | null;
  company: { id: string; tradeName: string } | null;
}

export interface ReservationDetail extends Reservation {
  guests: Array<{ id: string; isPrimary: boolean; guest: Guest }>;
  payments: Array<{
    id: string;
    amount: string;
    method: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
  chargeItems: Array<{
    id: string;
    type: string;
    description: string;
    quantity: string;
    unitPrice: string;
    totalAmount: string;
    registeredAt: string;
  }>;
  folio: { totalCharges: number; totalPaid: number; balance: number };
}

export interface Room {
  id: string;
  number: string;
  name: string | null;
  floor: number | null;
  status: string;
  roomType: { id: string; name: string };
}

export interface RoomType {
  id: string;
  name: string;
  basePrice: string;
  maxOccupancy: number;
}

export interface Guest {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  whatsapp?: string | null;
  nationality: string;
  tags: string[];
  companyId?: string | null;
  company?: { tradeName: string } | null;
}

export interface DashboardData {
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  pending: number;
  totalRooms: number;
  occupancyPercent: number;
}

// =========================================
//  Queries
// =========================================

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/reservations/dashboard'),
  });
}

export function useReservations(params: {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.q) query.set('q', params.q);
  query.set('limit', '500');

  return useQuery({
    queryKey: ['reservations', params],
    queryFn: () => apiFetch<Reservation[]>(`/reservations?${query.toString()}`),
  });
}

export function useReservation(id: string | null) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => apiFetch<ReservationDetail>(`/reservations/${id}`),
    enabled: !!id,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiFetch<Room[]>('/rooms'),
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: () => apiFetch<RoomType[]>('/rooms/types'),
  });
}

export function useAvailableRooms(params: {
  roomTypeId?: string;
  checkIn?: string;
  checkOut?: string;
}) {
  const q = new URLSearchParams();
  if (params.roomTypeId) q.set('roomTypeId', params.roomTypeId);
  if (params.checkIn) q.set('checkIn', params.checkIn);
  if (params.checkOut) q.set('checkOut', params.checkOut);

  return useQuery({
    queryKey: ['rooms', 'available', params],
    queryFn: () => apiFetch<Room[]>(`/rooms/available?${q.toString()}`),
    enabled: !!params.roomTypeId && !!params.checkIn && !!params.checkOut,
  });
}

export function useGuests(q?: string) {
  return useQuery({
    queryKey: ['guests', q],
    queryFn: () =>
      apiFetch<Guest[]>(`/guests${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useStaff(role?: string) {
  return useQuery({
    queryKey: ['users', { role }],
    queryFn: () =>
      apiFetch<StaffUser[]>(`/users${role ? `?role=${role}` : ''}`),
  });
}

// =========================================
//  Mutations
// =========================================

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, earlyCheckIn, notes }: { id: string; earlyCheckIn: boolean; notes?: string }) =>
      apiFetch(`/reservations/${id}/check-in`, {
        method: 'POST',
        body: { earlyCheckIn, notes },
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, skipNFSe = false }: { id: string; skipNFSe?: boolean }) =>
      apiFetch(`/reservations/${id}/check-out`, {
        method: 'POST',
        body: { skipNFSe, sendNFSeBy: 'EMAIL', earlyCheckout: false },
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useAssignRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId: string }) =>
      apiFetch(`/reservations/${id}/assign-room`, {
        method: 'PATCH',
        body: { roomId },
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/reservations/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<Reservation>('/reservations', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<Guest>('/guests', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

// =========================================
//  HOUSEKEEPING
// =========================================

export interface CleaningTask {
  id: string;
  type: string;
  status: string;
  priority: number;
  assignedToId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  inspectedAt: string | null;
  durationMinutes: number | null;
  issuesReported: string | null;
  photos: string[];
  notes: string | null;
  createdAt: string;
  scheduledFor: string | null;
  room: {
    id: string;
    number: string;
    floor: number | null;
    status: string;
    roomType: { name: string };
  };
  assignedTo: { id: string; name: string } | null;
  inspectedBy: { id: string; name: string } | null;
}

export interface HousekeepingDashboard {
  pending: number;
  inProgress: number;
  awaitingInspection: number;
  completedToday: number;
  avgDurationMinutes: number | null;
}

export function useCleaningTasks(params: { status?: string; assignedTo?: string } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.assignedTo) q.set('assignedTo', params.assignedTo);

  return useQuery({
    queryKey: ['cleaning-tasks', params],
    queryFn: () => apiFetch<CleaningTask[]>(`/cleaning-tasks?${q.toString()}`),
    refetchInterval: 30_000, // recarrega a cada 30s (operação em tempo quase real)
  });
}

export function useMyCleaningTasks() {
  return useQuery({
    queryKey: ['cleaning-tasks', 'mine'],
    queryFn: () => apiFetch<CleaningTask[]>('/cleaning-tasks/my-tasks'),
    refetchInterval: 30_000,
  });
}

export function useHousekeepingDashboard() {
  return useQuery({
    queryKey: ['housekeeping', 'dashboard'],
    queryFn: () => apiFetch<HousekeepingDashboard>('/cleaning-tasks/dashboard'),
    refetchInterval: 30_000,
  });
}

function invalidateHk(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['cleaning-tasks'] });
  qc.invalidateQueries({ queryKey: ['housekeeping'] });
  qc.invalidateQueries({ queryKey: ['rooms'] });
}

export function useAssignCleaning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      apiFetch(`/cleaning-tasks/${taskId}/assign`, {
        method: 'PATCH',
        body: { userId },
      }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useStartCleaning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/cleaning-tasks/${taskId}/start`, { method: 'POST', body: {} }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useCompleteCleaning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/cleaning-tasks/${taskId}/complete`, { method: 'POST', body: {} }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useApproveCleaning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/cleaning-tasks/${taskId}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useRejectCleaning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      apiFetch(`/cleaning-tasks/${taskId}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useReportCleaningIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description }: { taskId: string; description: string }) =>
      apiFetch(`/cleaning-tasks/${taskId}/issue`, {
        method: 'POST',
        body: { description },
      }),
    onSuccess: () => invalidateHk(qc),
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, status, reason }: { roomId: string; status: string; reason: string }) =>
      apiFetch(`/rooms/${roomId}/status`, {
        method: 'PATCH',
        body: { status, reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

// =========================================
//  PAYMENTS
// =========================================

export interface Payment {
  id: string;
  amount: string;
  method: string;
  status: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
  gatewayUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function useCreateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      amount,
      method,
      installments,
      description,
    }: {
      reservationId: string;
      amount: number;
      method: 'PIX' | 'CREDIT_CARD';
      installments?: number;
      description?: string;
    }) =>
      apiFetch<Payment>(`/reservations/${reservationId}/charge`, {
        method: 'POST',
        body: { amount, method, installments, description },
      }),
    onSuccess: (_, { reservationId }) => {
      qc.invalidateQueries({ queryKey: ['reservation', reservationId] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useConfirmManualPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, notes }: { paymentId: string; notes?: string }) =>
      apiFetch(`/payments/${paymentId}/confirm-manual`, {
        method: 'POST',
        body: { notes },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      amount,
      reason,
    }: {
      paymentId: string;
      amount?: number;
      reason: string;
    }) =>
      apiFetch(`/payments/${paymentId}/refund`, {
        method: 'POST',
        body: { amount, reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation'] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}
