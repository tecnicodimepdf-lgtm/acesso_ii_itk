import axios from 'axios';
import crypto from 'crypto';

const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');
const sha256 = (str: string) => crypto.createHash('sha256').update(str).digest('hex');
const sha1 = (str: string) => crypto.createHash('sha1').update(str).digest('hex');
const base64 = (str: string) => Buffer.from(str).toString('base64');

async function testRequest(config: any, label: string) {
  try {
    const res = await axios(config);
    const status = res.status;
    const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const location = res.headers['location'] || '';

    if (status === 200 && !bodyStr.startsWith('<!DOCTYPE') && !bodyStr.startsWith('<html')) {
      console.log(`🌟 [SUCCESS-200] ${label} | URL: ${config.url} | Body:`, bodyStr.substring(0, 300));
    } else if (status === 302 || status === 301) {
      console.log(`[REDIRECT-${status}] ${label} -> ${location}`);
    } else {
      console.log(`[STATUS-${status}] ${label} | Body: ${bodyStr.substring(0, 150)}`);
    }
  } catch (e: any) {
    if (e.response) {
      const status = e.response.status;
      const bodyStr = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
      console.log(`[ERROR-${status}] ${label} | Body: ${bodyStr.substring(0, 150)}`);
    } else {
      console.log(`[NET-ERROR] ${label} | ${e.message}`);
    }
  }
}

async function run() {
  const username = 'VOGAN20W';
  const pass = 'vOg0wM6e#23';

  console.log(`Testing all password encryption formats...`);

  const hashes = [
    { name: 'Plain', val: pass },
    { name: 'MD5 Lower', val: md5(pass).toLowerCase() },
    { name: 'MD5 Upper', val: md5(pass).toUpperCase() },
    { name: 'SHA256 Lower', val: sha256(pass).toLowerCase() },
    { name: 'SHA256 Upper', val: sha256(pass).toUpperCase() },
    { name: 'SHA1 Lower', val: sha1(pass).toLowerCase() },
    { name: 'SHA1 Upper', val: sha1(pass).toUpperCase() },
    { name: 'Base64', val: base64(pass) },
    { name: 'MD5 of MD5', val: md5(md5(pass)) }
  ];

  const paths = [
    '/api/v2/logon',
    '/itk/api/v2/logon',
    '/trk/ext/api/v2/logon'
  ];

  const host = 'https://dmpaccess.dimep-ams.com.br';

  for (const path of paths) {
    const url = `${host}${path}`;
    console.log(`\n------------------------------------------------------------`);
    console.log(`PATH: ${path}`);
    console.log(`------------------------------------------------------------`);

    for (const hash of hashes) {
      const labelGET = `GET | ${hash.name}`;
      const labelPOST = `POST | ${hash.name}`;

      // Test GET
      await testRequest({
        method: 'GET',
        url: `${url}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(hash.val)}`,
        headers: { 'Accept': 'application/json' },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 4000
      }, labelGET);

      // Test POST
      await testRequest({
        method: 'POST',
        url: `${url}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(hash.val)}`,
        headers: { 'Accept': 'application/json' },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 4000
      }, labelPOST);
    }
  }
}

run();
