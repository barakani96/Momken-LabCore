// Application-layer error: carries a stable kind that the HTTP layer maps to a status code.
export type ErrorKind = 'validation' | 'not_found' | 'rule' | 'conflict' | 'forbidden';
export class AppError extends Error {
  kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) { super(message); this.name = 'AppError'; this.kind = kind; }
}
export const STATUS_BY_KIND: Record<ErrorKind, number> = { validation: 400, forbidden: 403, not_found: 404, conflict: 409, rule: 422 };
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
export type AuditEntry = { actorId: string; action: string; entityType: string; entityId: string; details: Record<string, unknown> };
