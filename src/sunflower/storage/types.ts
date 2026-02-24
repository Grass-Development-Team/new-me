import type { Message } from "@/sunflower/adapter/message";

export interface InstanceData {
  instance_id: string;
  history: {
    [key: string]: Message[];
  };
}

export interface UserData {
  platform: string;
  user_id: string;
  score: number;
  last_interaction?: string;
  summary?: string;
}
