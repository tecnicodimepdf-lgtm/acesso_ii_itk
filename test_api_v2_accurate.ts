import axios from 'axios';
import crypto from 'crypto';

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function sha1(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex');
}

function base64(str: string): string {
  return Buffer.from(str).toString('base64');
}

async function run() {
  const username = 'VOGAN20W';
  const passwordPlain = 'vOg0wM6e#23';

  // Hashing variations
  const hashes = [
    { name: 'Plain', val: passwordPlain },
    { name: 'MD5 Lower', val: md5(passwordPlain).toLowerCase() },
    { name: 'MD5 Upper', val: md5(passwordPlain).toUpperCase() },
    { name: 'SHA256 Lower', val: sha256(passwordPlain).toLowerCase() },
    { name: 'SHA256 Upper', val: sha256(passwordPlain).toUpperCase() },
    { name: 'SHA1 Lower', val: sha1(passwordPlain).toLowerCase() },
    { name: 'SHA1 Upper', val: sha1(passwordPlain).toUpperCase() },
    { name: 'Base64', val: base64(passwordPlain) }
  ];

  // Request field structures
  const payloads = (hashVal: string) => [
    { label: 'username/password', data: { username, password: hashVal } },
    { label: 'Username/Password', data: { Username: username, Password: hashVal } },
    { label: 'usuario/senha', data: { usuario: username, senha: hashVal } },
    { label: 'Usuario/Senha', data: { Usuario: username, Senha: hashVal } },
    { label: 'login/senha', data: { login: username, senha: hashVal } },
    { label: 'user/password', data: { user: username, password: hashVal } },
    { label: 'Login/Senha', data: { Login: username, Senha: hashVal } }
  ];

  const hosts = [
    'https://dmpaccess.dimep-ams.com.br'
  ];

  const paths = [
    '/api/v2/logon',
    '/trk/ext/api/v2/logon',
    '/itk/api/v2/logon'
  ];

  console.log(`[ACCURATE TESTER] Starting tests with maxRedirects: 0 ...`);

  for (const host of hosts) {
    for (const path of paths) {
      const url = `${host}${path}`;
      console.log(`\n========================================`);
      console.log(`Testing URL: ${url}`);
      console.log(`========================================`);

      for (const hash of hashes) {
        for (const payload of payloads(hash.val)) {
          const description = `Hash: ${hash.name} | Fields: ${payload.label}`;
          try {
            const res = await axios.post(url, payload.data, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              maxRedirects: 0,
              validateStatus: () => true, // capture all statuses
              timeout: 4000
            });

            const status = res.status;
            const headers = res.headers;
            const contentType = headers['content-type'] || '';
            const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

            if (status === 200 && !bodyStr.startsWith('<!DOCTYPE') && !bodyStr.startsWith('<html')) {
              console.log(`🌟 [JWT RECEIVED] Status 200 | ${description}`);
              console.log(`   Response Body:`, bodyStr);
              return; // We found it!
            } else if (status === 302 || status === 301) {
              // Redirected - means unauthorized/anonymous triggered IIS Forms Authentication redirect
              // Do nothing, too noisy
            } else {
              console.log(`[DEBUG] Status ${status} | ${description} | Content-Type: ${contentType} | Body: ${bodyStr.substring(0, 100)}`);
            }
          } catch (e: any) {
            // Check if it's a redirect error or other error
            if (e.response) {
              const status = e.response.status;
              const bodyStr = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
              console.log(`[HTTP ERROR] Status ${status} | ${description} | Body: ${bodyStr.substring(0, 100)}`);
            } else {
              console.log(`[NET ERROR] ${description} | Error: ${e.message}`);
            }
          }
        }
      }
    }
  }

  console.log(`\nAccurate Tester finished without finding direct JSON 200 response.`);
}

run();
