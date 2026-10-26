import { SetupError } from "./errors";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SetupError(`${name} is not set. Add it to .env (see .env.example).`);
  }
  return value;
}
