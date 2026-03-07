import { expect, test } from "bun:test";
import { format_time_by_tz } from "./time";

test("format_time_by_tz should convert utc time to target timezone", () => {
  expect(format_time_by_tz("2026-03-07T12:34:56.000Z", "Asia/Shanghai")).toBe(
    "2026-03-07 20:34:56",
  );
});

test("format_time_by_tz should treat naive datetime string as utc", () => {
  expect(format_time_by_tz("2026/03/07 11:14:21", "Asia/Shanghai")).toBe(
    "2026-03-07 19:14:21",
  );
});

test("format_time_by_tz should default to utc when timezone is missing", () => {
  expect(format_time_by_tz("2026-03-07T12:34:56.000Z", undefined)).toBe(
    "2026-03-07 12:34:56",
  );
});

test("format_time_by_tz should keep original when timezone is invalid", () => {
  expect(format_time_by_tz("2026-03-07T12:34:56.000Z", "Not/A_Real_Zone")).toBe(
    "2026-03-07T12:34:56.000Z",
  );
});

test("format_time_by_tz should keep original when time cannot be parsed", () => {
  expect(format_time_by_tz("not-a-time", "Asia/Shanghai")).toBe("not-a-time");
});
