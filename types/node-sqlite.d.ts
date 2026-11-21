/**
 * Minimal type surface for Node's built-in SQLite module.
 *
 * The project pins @types/node 20, which predates node:sqlite. Node 26 provides the
 * module at runtime, so this declaration keeps strict TypeScript honest without adding
 * a native database dependency. Extend it only when a new call is used.
 */

declare module "node:sqlite" {
  export interface StatementResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    run(...params: unknown[]): StatementResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
    timeout?: number;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
