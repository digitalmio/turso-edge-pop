import { describe, expect, test } from "bun:test";
import { getSqlQueryType } from "./turso-response-parser";
describe("Turso Response Parser", () => {
  describe("getSqlQueryType", () => {
    test.each([
      ["SELECT * FROM users", "SELECT" as const],
      [
        `
        
        select
        *
        from users
        where foo = 'bar'

        `,
        "SELECT" as const,
      ],
      [
        "SELECT * FROM users WHERE id IN (SELECT id FROM admins)",
        "SELECT" as const,
      ],
      [
        "SELECT * FROM users WHERE id IN (DELETE FROM temp_table)",
        "MIXED" as const,
      ],
      ["UPDATE users SET name = 'Alice'", "UPDATE" as const],
      ["INSERT INTO users (name) VALUES ('John');", "INSERT" as const],
      ["DROP TABLE users;", "DROP" as const],
    ])("getSqlQueryType(%s) -> %s", (query, expected) => {
      expect(getSqlQueryType(query)).toBe(expected);
    });
  });
});
