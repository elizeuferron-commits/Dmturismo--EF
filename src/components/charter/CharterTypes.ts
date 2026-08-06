export interface Passenger {
  name: string;
  phone?: string;
  locationUrl?: string;
  boardingTime?: string;
}

export interface CustomTrip {
  id: string;
  dateTime: string;
  description: string;
  driverId: string;
  vehicleId: string;
  completed?: boolean;
}

export interface CharteredRoute {
  id: string;
  name: string;
  client: string;
  type: 'factory' | 'school' | 'other' | 'regular_random';
  daysOfWeek: number[]; // 0-6
  schedules: { departureTime: string; returnTime: string }[];
  fixedVehicleId?: string;
  fixedDriverId?: string;
  passengerCount: number;
  status: 'active' | 'inactive';
  locationUrl?: string;
  passengerName?: string;
  passengerPhone?: string;
  runState?: 'idle' | 'running';
  runStartedAt?: string | null;
  passengers?: Passenger[];
  contractValue?: number; // Valor mensal do contrato a receber
  customTrips?: CustomTrip[];
  completedDates?: string[];
}

export interface Client {
  id: string;
  name: string;
  companyName?: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  defaultTripValue?: number;
  workedDays?: string[];
  fixedRoutes?: {
    id: string;
    name: string;
    schedule: string;
    driverId: string;
    vehicleId?: string;
    daysOfWeek?: number[];
  }[];
  extraTripsNotes?: string;
  extraWorksNotes?: string;
}

export interface ClientTrip {
  id: string;
  client: string;
  clientId?: string;
  description: string;
  dateTime: string;
  origin?: string;
  destination?: string;
  value: number;
  driverId?: string;
  vehicleId?: string;
  status: 'pending' | 'completed' | 'cancelled';
  paymentStatus: 'open' | 'billed' | 'received';
  passengerCount?: number;
  isExtra?: boolean;
  hasExtraService?: boolean;
  extraServiceDesc?: string;
  extraServiceVal?: number;
  createdAt?: any;
}
