export interface BullMqConnectionOptions {
  host: string;
  port: number;
}

export function createBullMqConnectionOptions(host: string, port: number): BullMqConnectionOptions {
  return {
    host,
    port,
  };
}
