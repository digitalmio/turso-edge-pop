import type { ResultSet } from "@libsql/client";

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
// returns array/tuple of response and boolean indicating if write operation was performed
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
// returns array/tuple of response and boolean indicating if write operation was performed
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
    .trim() // Trim any remaining leading/trailing whitespace
    .toUpperCase();

type QueryType =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "CREATE"
  | "DROP"
  | "ALTER"
  | "TRUNCATE"
  | "REPLACE"
  | "EXEC"
  | "UNKNOWN"
  | "MIXED";

// determine type of query based on first command/word in statement
// this also takes to consideration all subqueries and makes sure that they are selects as well
// if they are not - they are marked as mixed
const getSqlQueryType = (rawQuery: string): QueryType => {
  const query = clearSQLInput(rawQuery);

  // Match the first SQL command
  const mainMatch = query.match(
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE|EXEC)\b/,
  );
  if (!mainMatch) return "UNKNOWN";

  const mainType = mainMatch[1];

  // If not SELECT, return the query type directly
  if (mainType !== "SELECT") return mainType as QueryType;

  // Function to extract content inside all parentheses
  const extractSubqueries = (sql: string) => {
    let depth = 0;
    let current = "";
    return [...sql].reduce<Array<string>>((subqueries, char) => {
      if (char === "(") {
        if (depth > 0) current += char;
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth === 0) {
          subqueries.push(current);
          current = "";
        } else {
          current += char;
        }
      } else if (depth > 0) {
        current += char;
      }
      return subqueries;
    }, []);
  };

  // Extract subqueries
  const subqueries = extractSubqueries(query);

  // Check if any subquery contains a modifying SQL command
  const hasModifyingStatement = subqueries.some((sub) =>
    /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE|EXEC)\b/.test(
      sub,
    ),
  );

  return hasModifyingStatement ? "MIXED" : "SELECT";
};

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
const hasMultipleWriteOperations = (statements: Query[]) =>
  statements.reduce((acc, el) => {
    const query = typeof el === "string" ? el : el.q;
    const elValue = getSqlQueryType(query) === "SELECT" ? 0 : 1;
    return acc + elValue;
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
      !["execute", "close"].includes(request.type as string),
  );

// check if the batch response contains write operations
export const isBatchResponseWithWrites = (
  tursoResponse: Record<string, unknown>,
) => {
  const response = tursoResponse.response as {
    type: string;
    result: {
      step_results: Array<{ affected_row_count?: number }>;
    };
  };

  if (response?.type === "batch") {
    return response.result.step_results.some(
      (res) => (res.affected_row_count ?? 0) !== 0,
    );
  }

  // non-batch response
  return false;
};
