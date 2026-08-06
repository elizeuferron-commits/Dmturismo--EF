import { UserRole } from '../types';

export let ROLE_PERMISSIONS: Record<string, string[]> = {
  'Dono / Proprietário': [
    'dashboard', 'trips', 'fleet', 'finance', 'fuel', 'inventory', 'gabinete', 'point', 'admin'
  ],
  'Motorista': ['dashboard', 'trips', 'fuel'],
  'Limpeza / Conservação': ['dashboard', 'trips', 'fuel', 'inventory'],
  'Administrativo': [
    'dashboard', 'trips', 'fleet', 'finance', 'fuel', 'inventory', 'gabinete', 'point'
  ],
  'Gestor de Frotas': [
    'dashboard', 'trips', 'fleet', 'finance', 'fuel', 'inventory', 'gabinete', 'point'
  ],
  'Coordenador Logístico': [
    'dashboard', 'trips', 'fleet', 'finance', 'fuel', 'inventory', 'gabinete', 'point'
  ],
  'Visitante': ['dashboard', 'trips', 'fuel']
};

export const setRolePermissions = (newPermissions: Record<string, string[]>) => {
  ROLE_PERMISSIONS = newPermissions;
};

export const hasPermission = (
  role: string | undefined, 
  sectionId: string, 
  email?: string, 
  userPermissions?: string[],
  name?: string
): boolean => {
  const isAdminRole = 
    role === 'Dono / Proprietário' || 
    role === 'Dono' || 
    role === 'Proprietário' || 
    role === 'Gestor de Frotas' || 
    role === 'Coordenador Logístico' || 
    role === 'Administrativo' ||
    email === 'elizeuferron@gmail.com';

  // Always allow admin roles / elizeu for absolutely everything
  if (isAdminRole) return true;

  // Check strict 'criador' restriction: strictly Elizeu Ferron
  if (sectionId === 'criador') {
    return email === 'elizeuferron@gmail.com';
  }

  if (!role) return false;
  
  // If user has custom permissions, they override role-based permissions
  if (userPermissions && userPermissions.length > 0) {
    return userPermissions.includes(sectionId);
  }

  if (role === 'admin') return true;
  const allowedSections = ROLE_PERMISSIONS[role];
  return allowedSections?.includes(sectionId) || false;
};
