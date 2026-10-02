import { describe, expect, it } from "vitest";
import { getColumnDefaultValuePresets } from "@/lib/table/columnDefaultPresets";

const context = { databaseType: "starrocks", dialect: "mysql", serverVersion: "3.5.0", unsetLabel: "No default" };
const column = (dataType: string) => ({ dataType, isNullable: true, isPrimaryKey: false, extra: {} });
const values = (dataType: string) => getColumnDefaultValuePresets(column(dataType), context).map((p) => p.value);

describe("StarRocks default preset provider", () => {
  it.each([
    ["int", ["", "NULL", "'0'", "'1'"]],
    ["decimal(10,2)", ["", "NULL", "'0'", "'1'"]],
    ["boolean", ["", "NULL", "'false'", "'true'"]],
    ["date", ["", "NULL", "1970-01-01"]],
    ["DATETIME", ["", "NULL", "CURRENT_TIMESTAMP"]],
    ["varchar(36)", ["", "NULL", "''", "(uuid())"]],
    ["varchar(35)", ["", "NULL", "''"]],
    ["varchar", ["", "NULL", "''"]],
    ["char(100)", ["", "NULL", "''"]],
    ["string", ["", "NULL", "''", "(uuid())"]],
    ["largeint", ["", "NULL", "'0'", "'1'", "(uuid_numeric())"]],
    ["bigint", ["", "NULL", "'0'", "'1'"]],
    ["array<int>", ["", "NULL"]],
    ["map<int, int>", ["", "NULL"]],
    ["struct<id int>", ["", "NULL"]],
    ["json", ["", "NULL"]],
    ["binary", ["", "NULL"]],
    ["hll", [""]],
    ["bitmap", [""]],
  ])("offers type-specific defaults for %s", (type, expected) => {
    expect(values(type)).toEqual(expected);
  });

  it("updates suggestions when a column's type or length changes", () => {
    const draft = column("varchar(36)");
    expect(getColumnDefaultValuePresets(draft, context).map((p) => p.value)).toContain("(uuid())");
    draft.dataType = "varchar(20)";
    expect(getColumnDefaultValuePresets(draft, context).map((p) => p.value)).not.toContain("(uuid())");
    draft.dataType = "datetime";
    expect(getColumnDefaultValuePresets(draft, context).map((p) => p.value)).toEqual(["", "NULL", "CURRENT_TIMESTAMP"]);
  });

  it("excludes NULL for nonnullable and primary key columns, and defaults for auto increment", () => {
    for (const draft of [
      { ...column("int"), isNullable: false },
      { ...column("int"), isPrimaryKey: true },
    ]) {
      expect(getColumnDefaultValuePresets(draft, context).map((p) => p.value)).not.toContain("NULL");
    }
    expect(getColumnDefaultValuePresets({ ...column("bigint"), extra: { autoIncrement: true } }, context)).toEqual([{ label: "No default", value: "" }]);
  });

  it.each([undefined, "5.1.0", "2.0.0"])("does not offer unverified UUID defaults on %s", (serverVersion) => {
    expect(getColumnDefaultValuePresets(column("varchar(100)"), { ...context, serverVersion }).map((p) => p.value)).not.toContain("(uuid())");
  });

  it("preserves MySQL and PostgreSQL presets", () => {
    expect(getColumnDefaultValuePresets(column("int"), { ...context, databaseType: "mysql" }).map((p) => p.value)).toEqual(["''", "NULL", "0", "1", "CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME"]);
    expect(getColumnDefaultValuePresets(column("varchar"), { ...context, databaseType: "postgres", dialect: "postgres" }).map((p) => p.value)).toContain("gen_random_uuid()");
  });
});
