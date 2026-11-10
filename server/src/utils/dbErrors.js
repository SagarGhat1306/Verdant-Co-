import pg from 'pg';

// 23505 = unique violation. `field` matches part of the constraint name,
// e.g. "externalId" in "Message_externalId_key".
export function isUniqueViolation(error, field) {
  if (error?.code !== '23505') return false;
  if (!field) return true;
  return String(error.constraint ?? '').includes(field);
}

// Postgres errors, plus connection problems (network, timeouts, dropped connections).
export function isDatabaseError(error) {
  return (
    error instanceof pg.DatabaseError ||
    Boolean(error?.syscall) ||
    /connection|timeout exceeded/i.test(String(error?.message))
  );
}
