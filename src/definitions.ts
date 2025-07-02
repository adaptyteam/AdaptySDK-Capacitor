export interface AdaptyCapacitorPluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
