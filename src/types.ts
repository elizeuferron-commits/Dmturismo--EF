export type UserRole = 
  | 'Dono / Proprietário' 
  | 'Gestor de Frotas' 
  | 'Coordenador Logístico' 
  | 'Administrativo' 
  | 'Motorista' 
  | 'Limpeza / Conservação' 
  | 'Visitante'
  | 'Aguardando Liberação'
  | 'Pendente de Liberação'
  | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  requestedRole?: UserRole;
  photoURL?: string;
  permissions?: string[];
  lastActive?: string;
}

export interface VehiclePreventiveKMRoute {
  id: string;
  routeName: string;
  kmInterval: number;
  lastKM: number;
  nextDueKM: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  prefix?: string;
  model: string;
  brand?: string;
  type: 'van' | 'bus' | 'microbus' | 'car' | 'motorcycle' | string;
  capacity: number;
  currentOdometer: number;
  factoryYear: string;
  renavam?: string;
  chassi?: string;
  responsibleDriverId?: string;
  responsibleDriverName?: string;
  licenseExpiration: string;
  spvatExpiration?: string;
  tourismLicenseExpiration: string;
  cadasturExpiration?: string;
  anttExpiration?: string;
  mercosulLicenseExpiration?: string;
  detroArtespExpiration?: string;
  sieExpiration?: string;
  municipalLicenseExpiration?: string;
  tacografoExpiration?: string;
  insuranceExpiration: string;
  nextOilChangeKM?: number;
  nextOilChangeDate?: string;
  nextTireRotationKM?: number;
  nextTireRotationDate?: string;
  nextPreventiveMaintenanceDate?: string;
  nextMaintenanceKM?: number;
  lastMaintenanceDate?: string;
  lastMaintenanceKM?: number;
  photoUrl?: string;
  status: 'available' | 'maintenance' | 'trip' | 'sold';
  featured?: boolean;
  updatedAt: string;
  preventiveKMConfig?: VehiclePreventiveKMRoute[];
}

export interface FinancialTransaction {
  id: string;
  type: 'payable' | 'receivable';
  category: string;
  description: string;
  supplier?: string;
  barcode?: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  refId?: string;
  refType?: 'maintenance' | 'trip' | 'fuel' | 'other';
  observations?: string;
  specializedFields?: any;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  cpf?: string;
  rg?: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpiration?: string;
  phone: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive';
  birthDate?: string;
  admissionDate?: string;
  photoUrl?: string;
  permissions?: string[];
  workSchedule?: WorkSchedule;
}

export interface WorkShift {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface WorkSchedule {
  monToFri: {
    morning: WorkShift;
    afternoon: WorkShift;
  };
  saturday?: WorkShift;
  sunday?: WorkShift;
}

export interface FuelTank {
  id: string;
  name: string;
  fuelType: string;
  capacity: number;
  currentLevel: number;
  updatedAt: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  fuelTankId?: string;
  isExternal?: boolean;
  location?: string;
  quantity: number;
  arlaQuantity?: number;
  arlaTankId?: string;
  odometer: number;
  cost: number;
  timestamp: string;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  description: string;
  type: 'preventive' | 'corrective';
  status: 'pending' | 'completed';
  cost: number;
  odometer?: number;
  scheduledDate: string;
  completedAt?: string;
  nextMaintenanceKM?: number;
  nextPreventiveMaintenanceDate?: string;
  createdAt?: any;
  attachments?: { name: string; url: string; type: 'image' | 'pdf' | 'word' | 'excel' }[];
  partsReplaced?: string;
  provider?: string;
  checklist?: {
    oilChanged: boolean;
    filtersChanged: boolean;
    frontPadsChanged: boolean;
    rearPadsChanged: boolean;
    frontDiscsChanged: boolean;
    rearDiscsChanged: boolean;
    airConditioning?: boolean;
    tires?: boolean;
    suspension?: boolean;
    transmission?: boolean;
    others?: string[];
  };
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  vehicleType?: 'ÔNIBUS' | 'MICRO-ÔNIBUS' | 'VAN' | 'OUTROS';
}

export interface FuelEntry {
  id: string;
  tankId: string;
  quantity: number;
  cost: number;
  supplier?: string;
  timestamp: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'issue' | 'n/a';
}

export interface Checklist {
  id: string;
  vehicleId: string;
  responsible: string;
  odometer: number;
  date: string;
  observations: string;
  items: ChecklistItem[];
}

export interface Passenger {
  name: string;
  document: string;
}

export interface Stop {
  location: string;
  arrivalTime: string;
}

export interface TripObservation {
  id: string;
  type: 'complaint' | 'compliment' | 'lost_found' | 'improvement';
  text: string;
  author: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  secondDriverId?: string;
  title: string;
  origin: string;
  destination: string;
  stops: Stop[];
  tripType: 'state' | 'interstate' | 'mercosur';
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  passengers: Passenger[];
  passengerCount?: number;
  documentation: { label: string; checked: boolean }[];
  attachments?: { name: string; url: string; type: 'image' | 'pdf' | 'word' | 'excel' }[];
  notes?: string;
  osNumber?: string;
  type?: string;
  createdAt?: any;
  observations?: TripObservation[];
  accommodation?: 'Por Conta' | 'DM' | 'AM' | 'Cliente' | 'Terceiros' | string;
  meals?: 'Por Conta' | 'DM' | 'AM' | 'Cliente' | 'Terceiros' | string;
  tripValue?: number;
  client?: string;
  paymentStatus?: string;
}

export interface Journey {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime?: string;
  breaks: { start: string; end?: string }[];
  status: 'active' | 'on_break' | 'completed';
  entryType?: 'normal' | 'vacation' | 'day_off' | 'overtime';
  notes?: string;
  totalMinutes?: number;
  location?: { lat: number; lng: number };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
