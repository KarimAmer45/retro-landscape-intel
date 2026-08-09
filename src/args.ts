export function readArgument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  // Without this guard, `--tag --limit 250` would silently ingest the tag "--limit".
  if (value === undefined || value.startsWith("--")) throw new Error(`--${name} requires a value.`);
  return value;
}

export function readPositiveInteger(name: string, fallback: number): number {
  const raw = readArgument(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer; received "${raw}".`);
  return parsed;
}

/** Validates an environment override separately so its failure is not reported as a bad CLI flag. */
export function readPositiveIntegerEnvironment(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer; received "${raw}".`);
  return parsed;
}
