export default interface AdapterConfig {
  api_key: string;
  base_url: string;
  model: string;
  system_prompt: string;

  max_history_length?: number;
}
