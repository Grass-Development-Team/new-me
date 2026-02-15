import type Sunflower from ".";

import type { Message } from "@/sunflower/adapter/message";

import type Scene from "@/sunflower/scene";

export default class Instance {
  id: string;
  scene: Scene;

  private sunflower: Sunflower;
  private history: Message[] = [];

  constructor(id: string, scene: Scene, sunflower: Sunflower) {
    this.id = id;
    this.scene = scene;
    this.sunflower = sunflower;
  }

  async *generate() {}
}
