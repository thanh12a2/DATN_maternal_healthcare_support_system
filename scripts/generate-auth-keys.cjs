const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(process.argv[2] || process.cwd());
fs.mkdirSync(outputDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(path.join(outputDir, 'auth-private.pem'), privateKey);
fs.writeFileSync(path.join(outputDir, 'auth-public.pem'), publicKey);

console.log(`Generated auth key pair in ${outputDir}`);
