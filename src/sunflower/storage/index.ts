import { Level } from "level";

export default class Storage {
  private db: Level;

  private user;
  private instance;

  constructor(location: string) {
    this.db = new Level(location, { valueEncoding: "json" });

    this.user = this.db.sublevel("users", { valueEncoding: "json" });
    this.instance = this.db.sublevel("instances", { valueEncoding: "json" });
  }

  async init() {
    await this.db.open();
  }
}
