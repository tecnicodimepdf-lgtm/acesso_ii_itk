import dotenv from 'dotenv';
dotenv.config({ override: true });

import axios from 'axios';

function getCleanToken() {
  const raw = process.env.DMP_ACCESS_TOKEN || '';
  let tokenStr = raw.trim();
  if (tokenStr.toUpperCase().startsWith('NAK ')) {
    tokenStr = tokenStr.substring(4).trim();
  } else if (tokenStr.toUpperCase().startsWith('BEARER ')) {
    tokenStr = tokenStr.substring(7).trim();
  }
  return tokenStr;
}

const JWT_PAYLOAD = (() => {
  try {
    const token = getCleanToken();
    const payload = Buffer.from(token.split('.')[1], 'base64').toString();
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
})();

async function testWithOwnPointer() {
  const token = getCleanToken();
  const pointerId = JWT_PAYLOAD?.nameid || '61099008003671';
  console.log(`=== INICIANDO TESTE COM O POINTER DO PRÓPRIO TOKEN: ${pointerId} ===`);

  const baseUrl = "https://dmpaccess.dimep-ams.com.br/itk/api/v1/";
  console.log(`URL de Teste: ${baseUrl}`);
  
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 30000 // Timeout maior caso o servidor esteja lento
  });

  // 1. AccessLog/Pointer/{pointerId} no PATH com o pointerId real do Token!
  try {
    console.log(`\n-> Buscando AccessLog/Pointer/${pointerId}...`);
    const res = await client.get(`AccessLog/Pointer/${pointerId}`);
    console.log("   Status:", res.status);
    console.log("   Content-Type:", res.headers['content-type']);
    const bodyStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    if (bodyStr.startsWith('<!DOCTYPE') || bodyStr.startsWith('<html')) {
      console.log("   AVISO: Retornou página HTML de Logon!");
    } else {
      console.log("   SUCESSO! Retornou dados reais JSON!");
      console.log("   Contagem de items:", Array.isArray(res.data) ? res.data.length : "N/A");
      console.log("   Corpo (primeiros 500 chars):", bodyStr.substring(0, 500));
    }
  } catch (e: any) {
    console.log("   FALHOU AccessLog/Pointer com erro:", e.message);
    if (e.response) {
      console.log("   Status de Erro:", e.response.status);
      console.log("   Dados de Erro:", JSON.stringify(e.response.data));
    }
  }

  // 2. Person/BasicData passando o pointerId correto como Query Parameter
  try {
    console.log(`\n-> Buscando Person/BasicData?pointerId=${pointerId}...`);
    const res = await client.get(`Person/BasicData?pointerId=${pointerId}`);
    console.log("   Status:", res.status);
    const bodyStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    if (bodyStr.startsWith('<!DOCTYPE') || bodyStr.startsWith('<html')) {
      console.log("   AVISO: Retornou página HTML de Logon!");
    } else {
      console.log("   SUCESSO! Retornou dados reais JSON!");
      console.log("   Corpo (primeiros 500 chars):", bodyStr.substring(0, 500));
    }
  } catch (e: any) {
    console.log("   FALHOU Person/BasicData com erro:", e.message);
    if (e.response) {
      console.log("   Status de Erro:", e.response.status);
      console.log("   Dados de Erro:", JSON.stringify(e.response.data));
    }
  }
}

testWithOwnPointer();
