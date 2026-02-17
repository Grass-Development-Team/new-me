import { Level } from "level";

export default class Storage {
  private db: Level;

  constructor(location: string) {
    this.db = new Level(location, { valueEncoding: "json" });
  }

  sub_level(name: string) {
    return this.db.sublevel(name, { valueEncoding: "json" });
  }

  async put(key: string, value: any) {
    this.db.put(key, value);
  }

  async get(key: string) {
    return this.db.get(key);
  }

  async open() {
    this.db.open();
  }

  async close() {
    this.db.close();
  }
}
