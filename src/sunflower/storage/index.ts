import type { InstanceData, UserData } from "./types";

export default abstract class Storage {
  abstract init(): Promise<void>;

  abstract set_user(platform: string, data: UserData): Promise<void>;
  abstract get_user(platform: string, user_id: string): Promise<UserData>;
  abstract del_user(platform: string, user_id: string): Promise<void>;

  abstract set_instance(instance_id: string, data: InstanceData): Promise<void>;
  abstract get_instance(instance_id: string): Promise<InstanceData>;
  abstract del_instance(instance_id: string): Promise<void>;

  protected get_user_key(platform: string, user_id: string) {
    return `${platform}::${user_id}`;
  }
}
