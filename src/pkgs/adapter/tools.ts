export default abstract class Tools {
  abstract readonly name: string;
  abstract readonly description: string;

  abstract call(...args: any[]): Promise<string>;
}
