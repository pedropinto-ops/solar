'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api-client';

// =========================================
//  Usuário logado (mesma queryKey do AppShell → sem chamada duplicada)
// =========================================

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () =>
      apiFetch<{ user: { name: string; role: string; email: string } }>('/auth/me'),
  });
}

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

// ---- Gestão de usuários (ADMIN/MANAGER) ----

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function useUsersManagement() {
  return useQuery({
    queryKey: ['users', 'management'],
    queryFn: () => apiFetch<ManagedUser[]>('/users?scope=all'),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      phone?: string;
      role: string;
      password: string;
    }) => apiFetch('/users', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      phone?: string;
      role?: string;
      active?: boolean;
    }) => apiFetch(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch(`/users/${id}/password`, { method: 'PATCH', body: { password } }),
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
    name: string | null;
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
  overdue: {
    count: number;
    rooms: Array<{ number: string; hours: number }>;
  };
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
    mutationFn: (params: { taskId: string; checklist?: unknown }) =>
      apiFetch(`/cleaning-tasks/${params.taskId}/complete`, {
        method: 'POST',
        body: { checklist: params.checklist },
      }),
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

// ============================================================
// Almoxarifado (estoque)
// ============================================================

export interface StockProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitMeasure: string;
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
  minLevel: number | null;
  low: boolean;
}

export interface StockMovementItem {
  id: string;
  type: 'IN' | 'OUT' | 'LOSS' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { name: string; unitMeasure: string };
  userName: string | null;
}

function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['stock'] });
}

export function useStockProducts() {
  return useQuery({
    queryKey: ['stock', 'products'],
    queryFn: () => apiFetch<StockProduct[]>('/stock/products'),
  });
}

export function useStockMovements() {
  return useQuery({
    queryKey: ['stock', 'movements'],
    queryFn: () => apiFetch<StockMovementItem[]>('/stock/movements'),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      sku?: string;
      category: string;
      unitMeasure: string;
      unitPrice: number;
      unitCost?: number;
      initialQuantity: number;
      minLevel?: number;
    }) => apiFetch('/stock/products', { method: 'POST', body }),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...body }: { productId: string } & Record<string, unknown>) =>
      apiFetch(`/stock/products/${productId}`, { method: 'PATCH', body }),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useStockMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      productId: string;
      type: 'IN' | 'OUT' | 'LOSS' | 'ADJUSTMENT';
      quantity: number;
      reason?: string;
    }) => apiFetch('/stock/movements', { method: 'POST', body }),
    onSuccess: () => invalidateStock(qc),
  });
}

// =========================================
//  Relatórios gerenciais
// =========================================

export interface ReportSummary {
  start: string;
  end: string;
  days: number;
  totalRooms: number;
  availableRoomNights: number;
  roomNightsSold: number;
  occupancyPercent: number;
  roomRevenue: number;
  consumptionRevenue: number;
  totalRevenue: number;
  adr: number;
  revpar: number;
  reservationsInPeriod: number;
  avgStayNights: number;
  ticketMedio: number;
  receivedInPeriod: number;
  outstanding: number;
  previous: {
    roomRevenue: number;
    totalRevenue: number;
    consumptionRevenue: number;
    occupancyPercent: number;
    adr: number;
    revpar: number;
    roomNightsSold: number;
    reservationsInPeriod: number;
    receivedInPeriod: number;
  };
  bySource: Array<{
    source: string;
    reservations: number;
    roomNights: number;
    revenue: number;
  }>;
  byDay: Array<{
    date: string;
    occupiedRooms: number;
    occupancyPercent: number;
    revenue: number;
  }>;
}

export interface ReportForecast {
  generatedAt: string;
  totalRooms: number;
  horizons: Array<{
    days: number;
    roomNights: number;
    revenue: number;
    reservations: number;
    occupancyPercent: number;
  }>;
}

export function useReportSummary(start: string, end: string) {
  return useQuery({
    queryKey: ['reports', 'summary', start, end],
    queryFn: () =>
      apiFetch<ReportSummary>(
        `/reports/summary?start=${start}&end=${end}`,
      ),
    enabled: Boolean(start && end),
  });
}

export function useReportForecast() {
  return useQuery({
    queryKey: ['reports', 'forecast'],
    queryFn: () => apiFetch<ReportForecast>('/reports/forecast'),
  });
}

// =========================================
//  Preços (diárias + tarifas por data)
// =========================================

export interface RatePeriodItem {
  id: string;
  name: string;
  roomTypeId: string | null;
  startDate: string;
  endDate: string;
  adjustType: 'ABSOLUTE' | 'PERCENT';
  value: number;
  priority: number;
  active: boolean;
}

export interface PackageItem {
  id: string;
  name: string;
  kind: 'CLOSED_PRICE' | 'LOS_DISCOUNT';
  active: boolean;
  nights: number | null;
  price: number | null;
  includedItems: string[];
  description: string | null;
  minNights: number | null;
  discountPercent: number | null;
}

export interface PricingOverview {
  childFee: number;
  childFreeMaxAge: number;
  childFeeMaxAge: number;
  roomTypes: Array<{ id: string; name: string; basePrice: number }>;
  periods: RatePeriodItem[];
  packages: PackageItem[];
}

export interface PriceCalendar {
  basePrice: number;
  days: Array<{ date: string; adultRate: number; ruleName: string | null }>;
}

export function usePricingOverview() {
  return useQuery({
    queryKey: ['pricing', 'overview'],
    queryFn: () => apiFetch<PricingOverview>('/pricing/overview'),
  });
}

export function usePriceCalendar(roomTypeId: string, start: string, end: string) {
  return useQuery({
    queryKey: ['pricing', 'calendar', roomTypeId, start, end],
    queryFn: () =>
      apiFetch<PriceCalendar>(
        `/pricing/calendar?roomTypeId=${roomTypeId}&start=${start}&end=${end}`,
      ),
    enabled: Boolean(roomTypeId && start && end),
  });
}

export function useUpdateBasePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomTypeId, basePrice }: { roomTypeId: string; basePrice: number }) =>
      apiFetch(`/pricing/room-types/${roomTypeId}/base-price`, {
        method: 'PATCH',
        body: { basePrice },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useCreateRatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      roomTypeId?: string | null;
      startDate: string;
      endDate: string;
      adjustType: 'ABSOLUTE' | 'PERCENT';
      value: number;
      priority: number;
    }) => apiFetch('/pricing/periods', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useUpdateRatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/pricing/periods/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useDeleteRatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/pricing/periods/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/pricing/packages', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/pricing/packages/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/pricing/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });
}

// =========================================
//  Painel de quartos (recepção)
// =========================================

export type RoomBoardState =
  | 'OCCUPIED'
  | 'DEPARTING'
  | 'ARRIVING'
  | 'FREE'
  | 'CLEANING'
  | 'BLOCKED';

export interface RoomBoard {
  summary: {
    total: number;
    occupied: number;
    departingToday: number;
    arrivingToday: number;
    free: number;
    cleaning: number;
    blocked: number;
  };
  rooms: Array<{
    id: string;
    number: string;
    name: string | null;
    floor: number | null;
    roomType: string;
    status: string;
    state: RoomBoardState;
    occupant: {
      guestName: string;
      checkOutDate: string;
      guests: number;
      departingToday: boolean;
    } | null;
    arrivalGuest: string | null;
  }>;
}

export function useRoomBoard() {
  return useQuery({
    queryKey: ['rooms', 'board'],
    queryFn: () => apiFetch<RoomBoard>('/rooms/board'),
    refetchInterval: 30_000, // wallboard ao vivo
    refetchOnWindowFocus: true,
  });
}
