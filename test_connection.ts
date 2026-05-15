import { clientes_api } from './src/server/dmpClient';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('--- TESTANDO CONEXÃO DMP ACCESS II ---');
  console.log('Base URL:', process.env.BASE_URL);
  const dmpToken = process.env.DMP_ACCESS_TOKEN || '';
  console.log('DMP_ACCESS_TOKEN (primeiros 20 chars):', dmpToken.substring(0, 20) + '...');
  const token = process.env.TOKEN || '';
  console.log('TOKEN (primeiros 20 chars):', token.substring(0, 20) + '...');
  
  try {
    const tokenStr = process.env.DMP_ACCESS_TOKEN || '';
    let cnpj = '';
    try {
      const parts = tokenStr.split('.');
      const payloadPart = parts.length === 3 ? parts[1] : (parts.length === 2 ? parts[1] : '');
      if (payloadPart) {
        const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString());
        cnpj = payload.nameid;
        console.log('CNPJ extraído do token (NameId):', cnpj);
      }
    } catch (e) {
      console.log('Erro ao extrair CNPJ:', e);
    }
    
    // Forçamos o CNPJ correto se soubermos qual é (15 dígitos conforme resumo)
    if (cnpj && cnpj.length === 14) {
       console.log('Detectado CNPJ de 14 dígitos, verificando se deve ser 15...');
       // cnpj = "610990080003671"; // Se necessário
    }

    if (cnpj) {
      console.log(`Chamando /api/v1/AccessLog/Pointer/${cnpj} (verificação)...`);
      const { getDmpClient } = await import('./src/server/dmpClient');
      try {
        const resLog = await getDmpClient().get(`/api/v1/AccessLog/Pointer/${cnpj}`);
        console.log('SUCESSO NO ACESSO AO LOG!');
        console.log('Dados (resumo):', JSON.stringify(resLog.data).substring(0, 100));
      } catch (e: any) {
        console.log('ERRO NO ACESSO AO LOG:', e.response?.status, e.response?.data);
      }
    }

    if (cnpj) {
      console.log(`\nTentando /api/v1/Person/BasicData/Pointer/${cnpj}...`);
      try {
        const resPtr = await getDmpClient().get(`/api/v1/Person/BasicData/Pointer/${cnpj}`);
        console.log('SUCESSO EM Person/BasicData/Pointer!');
        console.log('Dados:', JSON.stringify(resPtr.data).substring(0, 100));
      } catch (e: any) {
        console.log('ERRO EM /Person/BasicData/Pointer:', e.response?.status || 'ERR', e.response?.data || e.message);
      }
    }

    console.log('\nTentando /INTEGRADOR/api/v1/Person/BasicData...');
    try {
      const resInt = await getDmpClient().get('/INTEGRADOR/api/v1/Person/BasicData');
       console.log('SUCESSO EM /INTEGRADOR/api/v1!');
    } catch (e: any) {
       console.log('ERRO EM /INTEGRADOR/api/v1:', e.response?.status || 'ERR', e.response?.data || e.message);
    }

    if (cnpj) {
      console.log(`\nTentando query param 'cnpj'=${cnpj}...`);
      try {
        const resQry = await getDmpClient().get('/api/v1/Person/BasicData', {
          params: { cnpj: cnpj }
        });
        console.log('SUCESSO COM QUERY PARAM CNPJ!');
      } catch (e: any) {
        console.log('ERRO COM QUERY PARAM CNPJ:', e.response?.status || 'ERR', e.response?.data || e.message);
      }
    }

    console.log('\nTentando /itk/api/v1/Person/BasicData (via getBasicPersonsData)...');
    const data = await clientes_api.getBasicPersonsData();
    console.log('SUCESSO!');
    if (Array.isArray(data)) {
      console.log('Quantidade de registros recebidos:', data.length);
      if (data.length > 0) {
        console.log('Exemplo do primeiro registro:', JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log('Tipo do dado recebido:', typeof data);
      console.log('Conteúdo:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('ERRO NA CONEXÃO:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('URL Base utiliada:', error.config.baseURL);
      console.error('URL Completa:', error.config.url);
      console.error('Headers:', JSON.stringify(error.config.headers, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

test();
