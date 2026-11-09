export type ItemKind = "place" | "lodging";

export type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
};

export type Day = {
  id: string;
  tripId: string;
  date: string;
  title: string;
  note: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  locked?: boolean;
  lockedFrom?: string;
  lockedTo?: string;
};

export type MapSource = "amap" | "unverified";

export type Place = {
  id: string;
  tripId: string;
  name: string;
  area: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  mapSource?: MapSource;
  amapPoiId?: string;
  amapAddress?: string;
  amapLng?: number | null;
  amapLat?: number | null;
  amapFetchedAt?: number | null;
};

export type Lodging = {
  id: string;
  tripId: string;
  name: string;
  area: string;
  note: string;
  checkIn: string;
  checkOut: string;
  createdAt: number;
  updatedAt: number;
  mapSource?: MapSource;
  amapPoiId?: string;
  amapAddress?: string;
  amapLng?: number | null;
  amapLat?: number | null;
  amapFetchedAt?: number | null;
};

export type TimelineItem = {
  id: string;
  tripId: string;
  dayId: string;
  kind: ItemKind;
  refId: string;
  order: number;
  locked: boolean;
  timeLabel: string;
  createdAt: number;
  updatedAt: number;
};

export type TimelineEntry = {
  id: string;
  dayId?: string;
  kind: ItemKind;
  refId: string;
  name: string;
  area: string;
  note: string;
  timeLabel: string;
  locked: boolean;
  order: number;
  checkIn?: string;
  checkOut?: string;
  mapSource?: MapSource;
  amapPoiId?: string;
  amapAddress?: string;
  amapLng?: number | null;
  amapLat?: number | null;
  amapFetchedAt?: number | null;
};

export type DayView = {
  id: string;
  date: string;
  title: string;
  note: string;
  order: number;
  locked?: boolean;
  lockedFrom?: string;
  lockedTo?: string;
  items: TimelineEntry[];
};

export type TripSummary = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  dayCount: number;
  updatedAt: number;
};

export type TripDetail = TripSummary & {
  days: DayView[];
};

export type TripSnapshot = {
  trip: Trip;
  days: Day[];
  places: Place[];
  lodgings: Lodging[];
  timelineItems: TimelineItem[];
};

export type TripVersion = {
  id: string;
  tripId: string;
  label: string;
  createdAt: number;
  snapshot: TripSnapshot;
};

export type SpendCategory =
  | "lodging"
  | "transport"
  | "food"
  | "ticket"
  | "shopping"
  | "other";

export type CurrencyCode = "CNY" | "USD" | "JPY" | "EUR" | "HKD" | "TWD" | "KRW";

export type LedgerEntry = {
  id: string;
  tripId: string;
  date: string;
  category: SpendCategory;
  title: string;
  note: string;
  currency: CurrencyCode;
  plannedMinor: number;
  actualMinor: number | null;
  createdAt: number;
  updatedAt: number;
};

export type BookingKind = "lodging" | "train" | "reservation";

export type Booking = {
  id: string;
  tripId: string;
  kind: BookingKind;
  title: string;
  date: string;
  endDate: string;
  reference: string;
  detail: string;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type ChecklistItem = {
  id: string;
  tripId: string;
  title: string;
  note: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type Favorite = {
  id: string;
  tripId: string;
  title: string;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type TravelNote = {
  id: string;
  tripId: string;
  title: string;
  body: string;
  date: string;
  createdAt: number;
  updatedAt: number;
};

export type TripTools = {
  ledgerEntries: LedgerEntry[];
  bookings: Booking[];
  checklistItems: ChecklistItem[];
  favorites: Favorite[];
  travelNotes: TravelNote[];
};
