import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function protoRoot(): string {
  const candidates = [
    resolve(process.cwd(), 'proto'),
    resolve(process.cwd(), 'services', 'proto'),
    resolve(__dirname, '../../../../proto'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Unable to locate gRPC proto root');
  return found;
}

export function protoPath(relativePath: string): string {
  const root = protoRoot();
  const path = resolve(root, relativePath);
  if (!existsSync(path)) throw new Error(`Missing proto contract: ${relativePath}`);
  return path;
}
