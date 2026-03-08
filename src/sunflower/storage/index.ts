import { Level } from "level";
import type { InstanceData, UserData } from "./types";

/**
 * A simple key-value storage interface. The key is of type K, and the value is of type V.
 */
export abstract class KVStorage<K, V> {
  /**
   * Set a value for a given key. The value is a partial of V, meaning it can contain only some of the properties of V.
   *
   * @param key The key to set the value for.
   * @param value The value to set for the key. It can be a partial of V, meaning it can contain only some of the properties of V.
   *
   * @returns true if the operation is successful, false otherwise.
   */
  abstract set(key: K, value: Partial<V>): Promise<boolean>;

  /**
   * Get the value for a given key. The return type is an array of V, meaning it can return multiple values for a single key.
   *
   * @param key The key to get the value for.
   *
   * @returns An array of V, meaning it can return multiple values for a single key.
   */
  abstract get(key: K): Promise<Array<V>>;

  /**
   * Delete the value for a given key. The return type is a boolean, indicating whether the operation was successful or not.
   *
   * @param key The key to delete the value for.
   *
   * @returns true if the operation is successful, false otherwise.
   */
  abstract del(key: K): Promise<boolean>;
}

export default class Storage {
  private db: Level;

  private user;
  private instance;

  private user_cache = new Map<string, UserData>();
  private instance_cache = new Map<string, InstanceData>();

  constructor(location: string) {
    this.db = new Level(location, { valueEncoding: "json" });

    this.user = this.db.sublevel("users", {
      valueEncoding: this.db.valueEncoding("json"),
    });
    this.instance = this.db.sublevel("instances", {
      valueEncoding: this.db.valueEncoding("json"),
    });
  }

  private get_user_key(platform: string, user_id: string) {
    return `${platform}::${user_id}`;
  }

  async set_user(platform: string, data: UserData) {
    const key = this.get_user_key(platform, data.user_id);
    this.user_cache.set(key, data);
    return this.user.put(key, data);
  }

  async get_user(platform: string, user_id: string): Promise<UserData> {
    const key = this.get_user_key(platform, user_id);
    const cached = this.user_cache.get(key);
    if (cached) return cached;

    const data = ((await this.user.get(key)) ?? {
      platform,
      user_id,
      score: 10,
    }) as UserData;
    this.user_cache.set(key, data);
    return data;
  }

  async del_user(platform: string, user_id: string) {
    const key = this.get_user_key(platform, user_id);
    this.user_cache.delete(key);
    return this.user.del(key);
  }

  async set_instance(instance_id: string, data: InstanceData) {
    this.instance_cache.set(instance_id, data);
    return this.instance.put(instance_id, data);
  }

  async get_instance(instance_id: string) {
    const cached = this.instance_cache.get(instance_id);
    if (cached) return cached;

    const data = ((await this.instance.get(instance_id)) ?? {
      instance_id,
      history: {},
    }) as InstanceData;
    this.instance_cache.set(instance_id, data);
    return data;
  }

  async del_instance(instance_id: string) {
    this.instance_cache.delete(instance_id);
    return this.instance.del(instance_id);
  }

  async init() {
    await this.db.open();
  }
}
