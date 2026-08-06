import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasPermission } from '../lib/permissions';
import { UserProfile } from '../types';

interface ProtectedRouteProps {
  permissionKey: string;
  userProfile: UserProfile | null;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  permissionKey,
  userProfile,
  children
}) => {
  if (hasPermission(
    userProfile?.role, 
    permissionKey, 
    userProfile?.email, 
    userProfile?.permissions, 
    userProfile?.displayName
  )) {
    return <div className="contents">{children}</div>;
  }
  return <Navigate to="/dashboard" replace />;
};
