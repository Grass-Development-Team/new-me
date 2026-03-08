export default interface AdapterConfig<T = undefined> {
  api_key: string;
  base_url: string;
  model: string;
  system_prompt: string;
  extra_config?: T;
}
