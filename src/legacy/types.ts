// @ts-nocheck
export interface Variant {
  externalVariantId: string;
  name: string;
  currentQuantity: number | null;
  minQuantity: number | null;
  price: number | null;
  isAvailable: boolean;
}

export interface InventorySnapshot {
  id: string;
  platform: string;
  productId: string;
  externalProductId: string;
  previousQuantity: number | null;
  currentQuantity: number | null;
  quantityDecrease: number;
  restockAmount: number;
  decreasePercentage: number;
  observedAt: string;
  checkedAt?: string;
  syncRunId: string;
  isValid: boolean;
  isAnomaly: boolean;
  anomalyReason: string | null;
}

export interface Product {
  id: string;
  platform: string;
  externalProductId: string;
  name: string;
  sku: string;
  price: number | null;
  currency: string;
  imageUrl: string;
  productUrl: string;
  originalCategory: string;
  variants: Variant[];
  previousQuantity: number | null;
  currentQuantity: number | null;
  productStatus: "STABLE" | "OUT_OF_STOCK" | "LOW_STOCK" | "RESTOCKED" | "QUANTITY_DECREASE";
  firstSeenAt: string;
  lastCheckedAt: string;
  lastSuccessfullySynchronizedAt: string;
  createdAt: string;
  updatedAt: string;
  
  // Derived fields added on backend serialization
  quantityDecrease?: number;
  dailyQuantityDecrease?: number;
  restockAmount?: number;
  dailyRestockAmount?: number;
  decreasePercentage?: number;
  history?: InventorySnapshot[];
  withdrawnPieces?: number;
  withdrawalEvents?: number;
  lastWithdrawalAt?: string;
}

export interface SyncRun {
  id: string;
  platform: string;
  status: "CONNECTING" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  pagesRequested: number;
  pagesCompleted: number;
  productsReceived: number;
  productsUpdated: number;
  snapshotsCreated: number;
  productsSkipped: number;
  restocksDetected: number;
  quantityDecreasesDetected: number;
  retryCount: number;
  errors: any[];
  errorSummary?: string | null;
  expectedWithdrawalEvents?: number;
  savedWithdrawalEvents?: number;
  expectedWithdrawnPieces?: number;
  savedWithdrawnPieces?: number;
  expectedAffectedProducts?: number;
  savedAffectedProducts?: number;
  reconciliationStatus?: string;
  reconciliationError?: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string | null;
  capturedAt?: string | null;
  idempotencyKey?: string | null;
}

export interface WithdrawalEvent {
  id: string;
  platformConnectionId: string;
  productId: string;
  syncRunId: string | null;
  platform: string;
  previousQuantity: number | null;
  currentQuantity: number | null;
  quantityDecrease: number;
  observedAt: string;
  cairoDay: string;
  cairoHour: number;
  cairoTenMinuteSlot: number;
  isAnomaly: boolean;
  anomalyReason: string | null;
  createdAt: string;
}

export interface TenMinuteWithdrawalInterval {
  slot: 0 | 1 | 2 | 3 | 4 | 5;
  startMinute: number;
  endMinute: number;
  intervalLabel: string;

  withdrawnPieces: number;
  withdrawalEvents: number;
  affectedProducts: number;

  successfulSyncs: number;
  failedSyncs: number;
  partialSyncs: number;
  expectedSyncs: number;

  dataStatus:
    | "SUCCESS_WITH_ACTIVITY"
    | "SUCCESS_ZERO"
    | "FAILED"
    | "PARTIAL"
    | "MISSING"
    | "CURRENT_INCOMPLETE"
    | "NOT_SCHEDULED";

  dataCompletenessPercentage: number | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface SelectedHourWithdrawalDetails {
  selectedDate: string;
  selectedHour: number;
  intervals: TenMinuteWithdrawalInterval[];

  totalWithdrawnPieces: number;
  totalWithdrawalEvents: number;
  affectedProducts: number;

  highestInterval: TenMinuteWithdrawalInterval | null;
  completedIntervals: number;
  expectedIntervals: number;
  hourCompletenessPercentage: number;
}

export interface PlatformConnection {
  id: string;
  platform: "safka" | "custom";
  displayName: string;
  isActive: boolean;
  mode: "live" | "demo";
  baseUrl: string;
  productsEndpoint: string;
  method: string;
  authType: "none" | "apiKey" | "bearer";
  apiKeyHeader: string;
  apiKey?: string;
  accessToken?: string;
  customHeaders: Record<string, string>;
  fieldMapping: {
    productsPath: string;
    productIdPath: string;
    productNamePath: string;
    skuPath: string;
    quantityPath: string;
    pricePath: string;
    imagePath: string;
    categoryPath: string;
    variantsPath: string;
    productUrlPath: string;
  };
  paginationConfig: {
    type: "none" | "page" | "cursor";
    pageParameter: string;
    limitParameter: string;
    cursorParameter: string;
    limit: number;
    maxPages?: number;
  };
  lastConnectionStatus: string;
  lastConnectionTestAt: string | null;
  lastConnectionError?: string;
  createdAt: string;
  updatedAt: string;

  // New monitoring fields
  monitoring_enabled?: boolean;
  monitoring_interval_minutes?: number;
  minimum_provider_interval_minutes?: number;
  next_scheduled_sync_at?: string | null;
  last_scheduled_sync_at?: string | null;
  last_successful_sync_at?: string | null;
  last_failed_sync_at?: string | null;
  last_sync_status?: string | null;
}

export interface OverviewMetrics {
  totalTrackedProducts: number;
  lastHourQuantityDecrease: number;
  todayQuantityDecrease: number;
  restockedProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  lastSynchronization: string | null;
  nextSynchronization: string;
  synchronizationIntervalMinutes: number;
  synchronizationSuccessRate: number;
}

export interface ChartTimelinePoint {
  syncRunId: string;
  startedAt: string;
  quantityDecrease: number;
  restockAmount: number;
  label: string;
}

export interface WeeklyDayRecord {
  date: string;
  dayName: string;
  quantityDecrease: number;
  restockAmount: number;
}

export interface DashboardPayload {
  success: boolean;
  overview: OverviewMetrics;
  products: Product[];
  categories: string[];
  syncRuns: SyncRun[];
  chartTimeline: ChartTimelinePoint[];
  platformConnections: PlatformConnection[];
  weeklyHistory?: WeeklyDayRecord[];
  activityLogs?: ActivityLog[];
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    timezone: string;
    lastTickAt: string | null;
  };
}

export type Hour24 = number;

export function formatCairoHourArabic(hour24: Hour24): string {
  if (hour24 === 0) return "12:00 ص";
  if (hour24 < 12) return `${hour24}:00 ص`;
  if (hour24 === 12) return "12:00 م";
  return `${hour24 - 12}:00 م`;
}

export type AnalyticsNavigationIntent =
  | { type: 'last-completed-hour'; date: string; hour: number; }
  | { type: 'today'; date: string; metric: 'pieces' | 'events' | 'products'; }
  | null;

export interface ProductWithdrawalActivityRow {
  productId: string;
  externalProductId: string;
  productName: string;
  sku: string | null;
  category: string | null;
  platform: string;
  platformConnectionId: string;
  imageUrl: string | null;
  productUrl: string | null;
  price: number | null;
  currency: string;
  currentQuantity: number | null;

  selectedDate: string;

  withdrawnPieces: number;
  withdrawalEvents: number;
  activeHours: number;
  activeTenMinuteSlots: number;

  firstWithdrawalAt: string | null;
  lastWithdrawalAt: string | null;
}

export interface HourBundleRow {
  hour: number;
  withdrawnPieces: number;
  withdrawalEvents: number;
  affectedProducts: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface DayBundleResponse {
  meta: {
    selectedDate: string;
    timezone: string;
    platformConnectionId: string | null;
    category: string | null;
  };
  hours: HourBundleRow[];
}

export interface ProductDetailSelection {
  productId: string;
  selectedDate: string;
  platformConnectionId: string | null;
}

export interface ReconciliationMismatchDetails {
  syncRunId: string;
  snapshotEvents: number;
  savedEvents: number;
  snapshotPieces: number;
  savedPieces: number;
  snapshotProducts: number;
  savedProducts: number;
  eventDifference: number;
  pieceDifference: number;
  productDifference: number;
}

export interface ApiDiagnosticError {
  code: string;
  stage: string;
  message: string;
  severity: "CRITICAL" | "WARNING";
  details?: ReconciliationMismatchDetails;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  syncRunId: string | null;
  error: ApiDiagnosticError;
  warnings: ApiDiagnosticError[];
}

export interface ActivityLog {
  id: string;
  type: "sync" | "config" | "login";
  action: string;
  details: string;
  timestamp: string;
  user?: string;
}


