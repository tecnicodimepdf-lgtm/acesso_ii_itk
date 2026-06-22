import axios from 'axios';
import crypto from 'crypto';

const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');
const sha256 = (str: string) => crypto.createHash('sha256').update(str).digest('hex');

async function testRequest(config: any): Promise<boolean> {
  try {
    const res = await axios(config);
    const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const contentType = res.headers['content-type'] || '';
    
    if (res.status === 200 && !bodyStr.startsWith('<!DOCTYPE') && !bodyStr.startsWith('<html')) {
      console.log(`\n🌟🌟🌟 [SUCCESS!] Status ${res.status} | URL: ${config.url} | Method: ${config.method}`);
      console.log(`Headers sent:`, JSON.stringify(config.headers));
      console.log(`Response:`, bodyStr.substring(0, 500));
      return true;
    } else if (res.status !== 302 && res.status !== 301) {
      console.log(`[DEBUG] Status ${res.status} | Method: ${config.method} | URL: ${config.url} | Body: ${bodyStr.substring(0, 150)}`);
    }
  } catch (e: any) {
    if (e.response) {
      const bodyStr = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
      if (e.response.status !== 404 && e.response.status !== 302 && e.response.status !== 301) {
        console.log(`[HTTP ERROR] Status ${e.response.status} | URL: ${config.url} | Body: ${bodyStr.substring(0, 150)}`);
      }
    } else {
      console.log(`[NET ERROR] URL: ${config.url} | Error: ${e.message}`);
    }
  }
  return false;
}

async function run() {
  const username = 'VOGAN20W';
  const pass = 'vOg0wM6e#23';

  const passwords = [
    { label: 'Plain', val: pass },
    { label: 'MD5 Lower', val: md5(pass).toLowerCase() },
    { label: 'MD5 Upper', val: md5(pass).toUpperCase() },
    { label: 'SHA256 Lower', val: sha256(pass).toLowerCase() },
    { label: 'SHA256 Upper', val: sha256(pass).toUpperCase() }
  ];

  const hosts = [
    'https://dmpaccess.dimep-ams.com.br'
  ];

  const paths = [
    '/api/v2/logon',
    '/trk/ext/api/v2/logon',
    '/itk/api/v2/logon'
  ];

  console.log(`Starting format probes...`);

  for (const host of hosts) {
    for (const path of paths) {
      const url = `${host}${path}`;

      for (const pwd of passwords) {
        // 1. POST query parameters (like v1 but on v2)
        await testRequest({
          method: 'POST',
          url: `${url}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(pwd.val)}`,
          headers: { 'Accept': 'application/json' },
          maxRedirects: 0,
          validateStatus: () => true
        });

        // 2. GET query parameters
        await testRequest({
          method: 'GET',
          url: `${url}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(pwd.val)}`,
          headers: { 'Accept': 'application/json' },
          maxRedirects: 0,
          validateStatus: () => true
        });

        // 3. HTTP Basic Authorization header
        const basicAuthPlain = Buffer.from(`${username}:${pwd.val}`).toString('base64');
        await testRequest({
          method: 'POST',
          url: url,
          headers: {
            'Authorization': `Basic ${basicAuthPlain}`,
            'Accept': 'application/json'
          },
          maxRedirects: 0,
          validateStatus: () => true
        });

        await testRequest({
          method: 'GET',
          url: url,
          headers: {
            'Authorization': `Basic ${basicAuthPlain}`,
            'Accept': 'application/json'
          },
          maxRedirects: 0,
          validateStatus: () => true
        });
      }
    }
  }

  console.log(`Format probes completed.`);
}

run();
