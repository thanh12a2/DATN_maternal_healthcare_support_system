const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(process.argv[2] || process.cwd());
fs.mkdirSync(outputDir, { recursive: true });
const pair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
fs.writeFileSync(path.join(outputDir, 'patient-internal-private.pem'), pair.privateKey);
fs.writeFileSync(path.join(outputDir, 'patient-internal-public.pem'), pair.publicKey);
console.log('Generated patient-internal-private.pem and patient-internal-public.pem');
