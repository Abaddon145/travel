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
};

export type Place = {
  id: string;
  tripId: string;
  name: string;
  area: string;
  note: string;
  createdAt: number;
  updatedAt: number;
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
};

export type DayView = {
  id: string;
  date: string;
  title: string;
  note: string;
  order: number;
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
