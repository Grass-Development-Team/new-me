import { KVStorage } from ".";

export default class LevelDB<V> extends KVStorage<string, V> {
  set(key: string, value: Partial<V>): Promise<boolean> {
    // TODO
  }

  get(key: string): Promise<V[]> {
    //TODO
  }

  del(key: string): Promise<boolean> {
    // TODO
  }
}
