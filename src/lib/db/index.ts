// This file now uses Supabase (PostgreSQL) instead of SQLite
// All database functions are imported from queries.ts

export * from './queries';

/**
 * Temporary compatibility surface for legacy SQLite callers.
 * Supabase requests are asynchronous, so legacy synchronous SQL cannot be
 * executed here. Read operations return empty results to keep legacy pages
 * renderable while they are migrated; writes fail explicitly rather than
 * claiming that an order or product was saved.
 */
export function getDb(): any {
  return {
    prepare(sql: string) {
      const isCount = /count\s*\(/i.test(sql);
      return {
        get: () => (isCount ? { count: 0 } : null),
        all: () => [],
        run: () => {
          throw new Error('This operation still uses SQLite. Migrate it to Supabase before enabling writes.');
        },
      };
    },
  };
}
