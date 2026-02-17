export interface ToolParameters {
  [key: string]: any;
}

export default abstract class Tools<T = any, P = string> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters?: ToolParameters;
  abstract readonly required?: string[];

  abstract call(args: T): Promise<P>;
}
