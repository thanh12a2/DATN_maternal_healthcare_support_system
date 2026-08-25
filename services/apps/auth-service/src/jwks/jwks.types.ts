export interface JsonWebKey {
  kty: string;
  n?: string;
  e?: string;
  kid: string;
  alg: 'RS256';
  use: 'sig';
}

export interface JsonWebKeySet {
  keys: JsonWebKey[];
}
