import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function formatVehiclePlate(vehicle?: { plate?: string; prefix?: string; model?: string } | null): string {
  if (!vehicle) return '';
  const plate = vehicle.plate || '';
  const prefix = vehicle.prefix ? vehicle.prefix.trim() : '';
  if (prefix) {
    return `[FROTA #${prefix}] ${plate}`;
  }
  return plate;
}

export function formatVehicleLabel(vehicle?: { plate?: string; prefix?: string; model?: string; type?: string } | null): string {
  if (!vehicle) return 'A DEFINIR';
  const plate = vehicle.plate || '';
  const prefix = vehicle.prefix ? vehicle.prefix.trim() : '';
  const model = vehicle.model ? ` - ${vehicle.model}` : '';
  if (prefix) {
    return `FROTA #${prefix} | ${plate}${model}`;
  }
  return `${plate}${model}`;
}
