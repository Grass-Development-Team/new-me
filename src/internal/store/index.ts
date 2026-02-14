import { Level } from "level";
import type { Session } from "./types";

const db = new Level("data", { valueEncoding: "json" });
const user = db.sublevel<string, number>("score", {
  valueEncoding: db.valueEncoding("json"),
});
const sessions = db.sublevel<string, Session | string>("sessions", {
  valueEncoding: db.valueEncoding("json"),
});

export default db;
export { user, sessions };
