import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userPermissionOverrides } from '@/db/schema';
import type { AuthUser, AppRole } from './session';

export const PERMISSIONS = [
  'dashboard.read', 'patients.read', 'patients.create', 'orders.read', 'orders.create', 'orders.accession',
  'specimens.read', 'specimens.create', 'specimens.transition', 'results.read', 'results.enter', 'results.validate',
  'catalog.read', 'catalog.manage', 'quality.read', 'quality.manage', 'quality.audit', 'documents.read', 'documents.manage', 'documents.approve', 'finance.read', 'finance.manage',
  'inventory.read', 'inventory.manage', 'inventory.consume', 'procurement.read', 'procurement.manage', 'procurement.approve', 'procurement.receive', 'users.read', 'users.manage', 'audit.read', 'audit.export', 'reports.portal.manage', 'bloodbank.read', 'bloodbank.manage', 'bloodbank.issue'
] as const;
export type Permission = typeof PERMISSIONS[number];
const roleGrants: Record<AppRole, Permission[]> = {
  Admin: [...PERMISSIONS],
  'Lab Manager': ['dashboard.read','patients.read','patients.create','orders.read','orders.create','orders.accession','specimens.read','specimens.create','specimens.transition','results.read','results.enter','results.validate','catalog.read','catalog.manage','quality.read','quality.manage','quality.audit','documents.read','documents.manage','documents.approve','inventory.read','inventory.manage','inventory.consume','procurement.read','procurement.manage','procurement.approve','procurement.receive','audit.read','audit.export','reports.portal.manage', 'bloodbank.read', 'bloodbank.manage', 'bloodbank.issue'],
  'Lab Scientist': ['dashboard.read','patients.read','orders.read','specimens.read','specimens.transition','results.read','results.enter','catalog.read','quality.read','quality.audit','documents.read','inventory.read','inventory.consume','bloodbank.read'],
  Phlebotomist: ['dashboard.read','patients.read','patients.create','orders.read','specimens.read','specimens.create','specimens.transition'],
  Viewer: ['dashboard.read','patients.read','orders.read','specimens.read','results.read','catalog.read','quality.read','documents.read','inventory.read']
};
export function hasRolePermission(role: AppRole, permission: Permission) { return roleGrants[role].includes(permission); }
export async function can(user: AuthUser, permission: Permission): Promise<boolean> {
  if (user.role === 'Admin') return true;
  const [override] = await db.select({ allowed: userPermissionOverrides.allowed }).from(userPermissionOverrides)
    .where(and(eq(userPermissionOverrides.userId, user.id), eq(userPermissionOverrides.permissionKey, permission))).limit(1);
  return override ? override.allowed : hasRolePermission(user.role, permission);
}
