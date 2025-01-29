import type { ResultSet } from "@libsql/client";
import { Parser } from "node-sql-parser";
const parser = new Parser();

// format value to match Turso V2-V3 response format
export const formatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return { type: "null", value: null };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { type: "integer", value: value.toString() };
    }
    return { type: "float", value: value.toString() };
  }

  return { type: "text", value: value.toString() };
};

// parse Turso result to match Turso V2-V3 response format
// this is for /v2/pipeline and /v3/pipeline
export const parseTursoResultV2V3 = (
  result: ResultSet,
): [Record<string, unknown>, boolean] => {
  const rows = result.rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(formatValue);
    }
    return result.columns.map((col) => formatValue(row[col]));
  });

  return [
    {
      cols: result.columns.map((name) => ({
        name,
        decltype: null,
      })),
      rows,
      affected_row_count: result.rowsAffected || 0,
      last_insert_rowid: result.lastInsertRowid?.toString() ?? null,
      replication_index: null,
      rows_read: result.rows.length,
      rows_written: result.rowsAffected || 0,
      query_duration_ms: 0,
    },
    Boolean(result.rowsAffected),
  ];
};

// parse Turso result to match Turso V0 response format
// this is for /v0/query
export const parseTursoResultV0 = (
  result: ResultSet,
): [Record<"results", unknown>, boolean] => {
  return [
    {
      results: {
        columns: result.columns,
        rows: result.rows.map((row) => Object.values(row)),
        rows_read: result.rows.length,
        rows_written: result.rowsAffected || 0,
        last_insert_rowid: result.lastInsertRowid?.toString() ?? null,
        query_duration_ms: 0,
      },
    },
    Boolean(result.rowsAffected),
  ];
};

// clear SQL input to remove comments and trim whitespace
export const clearSQLInput = (input: string) =>
  input
    .replace(/--.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .trim(); // Trim any remaining leading/trailing whitespace

type Query = string | ParamQuery;
type ParamQuery = {
  q: string;
  params: undefined | Record<string, unknown> | Array<unknown>;
};

// check if the statements contain transaction keywords
export const hasTransactionKeywords = (statements: Query[]) =>
  statements
    .map((el) => (typeof el === "string" ? el : el.q))
    .some((el) => {
      const cleanStatement = clearSQLInput(el);
      return (
        cleanStatement.startsWith("BEGIN") ||
        cleanStatement.startsWith("COMMIT") ||
        cleanStatement.startsWith("ROLLBACK")
      );
    });

// check if the statements contain multiple write operations
// this will be needed to determine if we need to use transaction
export const hasMultipleWriteOperations = (statements: Query[]) =>
  statements
    .map((el) => (typeof el === "string" ? el : el.q))
    .reduce((acc, el) => {
      const ast = parser.astify(el, { database: "Sqlite" });
      const isNonSelect = Array.isArray(ast)
        ? ast.every((a) => a.type !== "select")
        : ast.type !== "select";
      return acc + +isNonSelect; // Using unary + operator to parse boolean as number
    }, 0) > 1;

// We don't need transaction if:
// - there is just 1 statement
// - multiple select statements
// - multiple statements with just 1 non-select statement
export const shouldUseTransactionCheck = (statements: Query[]) =>
  statements.length > 1 &&
  !hasTransactionKeywords(statements) && // parser will throw on transaction keywords, so lets make sure they are not there we don't support them anyway
  hasMultipleWriteOperations(statements);

// if requests contains types other than execute and close or simple batch, proxy to Turso
export const hasUnsupportedTypes = (requests: Record<string, unknown>[]) =>
  requests.some(
    (request: Record<string, unknown>) =>
      request.type !== "execute" &&
      request.type !== "close" &&
      request.type !== "batch",
  );

// check if the requests contain a conditional batch
// biome-ignore lint/suspicious/noExplicitAny: this will be an object, just need to check if key exists
export const hasConditionalBatch = (requests: Record<string, any>[]) =>
  requests.some((request) => {
    return (
      request.type === "batch" &&
      request?.batch?.steps?.some((step: Record<string, unknown>) =>
        Boolean(step.condition),
      )
    );
  });
