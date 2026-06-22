import dotenv from 'dotenv';
dotenv.config({ override: true });

import axios from 'axios';
import crypto from 'crypto';

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function tryLogin(url: string, body: any, label: string) {
  try {
    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 3000
    });
    console.log(`[SUCESSO] ${label} -> Status ${res.status}`);
    console.log(`  Body:`, JSON.stringify(res.data));
    return true;
  } catch (e: any) {
    if (e.response) {
      if (e.response.status !== 404) {
        console.log(`[FALHA] ${label} -> Status ${e.response.status}: ${JSON.stringify(e.response.data).substring(0, 200)}`);
      }
    } else {
      console.log(`[FALHA DE REDE] ${label} -> ${e.message}`);
    }
    return false;
  }
}

async function run() {
  const user = 'VOGAN20W';
  const pass = 'vOg0wM6e#23';

  console.log(`Iniciando probes simplificados para usuário ${user}...`);

  const hashes = [
    { name: 'Plain', val: pass },
    { name: 'MD5 Lower', val: md5(pass).toLowerCase() },
    { name: 'MD5 Upper', val: md5(pass).toUpperCase() },
    { name: 'SHA256 Lower', val: sha256(pass).toLowerCase() },
    { name: 'SHA256 Upper', val: sha256(pass).toUpperCase() }
  ];

  const urls = [
    'https://dmpaccess.dimep-ams.com.br/api/v2/logon',
    'https://dmpaccess.dimep-ams.com.br/trk/ext/api/v2/logon',
    'https://dmpaccess.dimep-ams.com.br/itk/api/v2/logon'
  ];

  for (const url of urls) {
    console.log(`\n--- Testando Endpoint: ${url} ---`);
    for (const hash of hashes) {
      // Testar { username, password }
      await tryLogin(url, { username: user, password: hash.val }, `Payload camelCase | Hash: ${hash.name}`);
      // Testar { Username, Password } 
      await tryLogin(url, { Username: user, Password: hash.val }, `Payload PascalCase | Hash: ${hash.name}`);
    }
  }

  console.log("\nProbes simplificados concluídos!");
}

run();
