import axios from 'axios';
import axiosRetry from 'axios-retry';
import { db } from './db.js';

const getTimeout = () => parseInt(process.env.TIMEOUT || '10000', 10);
const getJwtPayload = (tokenStr: string): any => {
  try {
    const parts = tokenStr.split(' ');
    const jwt = parts.length > 1 ? parts[1] : parts[0];
    const payload = Buffer.from(jwt.split('.')[1], 'base64').toString();
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
};

const isTokenExpired = (tokenStr: string) => {
  const payload = getJwtPayload(tokenStr);
  if (!payload || !payload.exp) return false;
  return Date.now() > payload.exp * 1000;
};

const isPlaceholder = (val?: string) => {
  if (!val) return true;
  const v = val.trim().toUpperCase();
  return (
    v === 'POINTER_CNPJ' ||
    v === 'URL_SEGMENT' ||
    v === 'DMP_ACCESS_TOKEN' ||
    v === 'BASE_URL' ||
    v === 'SEU_TOKEN_AQUI' ||
    v === 'YOUR_ACCESS_TOKEN_HERE' ||
    v === 'BASE_URL_API' ||
    v === 'BASE_URL'
  );
};

let cachedDynamicToken: string | null = null;
let lastTokenFetchTime = 0;

export async function fetchDynamicTokenIfNeeded(): Promise<string | null> {
  // If we already have a cached bearer token and it's not expired (and not about to expire in the next 60 seconds), return it.
  if (cachedDynamicToken && !isTokenExpired(cachedDynamicToken)) {
    try {
      const payload = getJwtPayload(cachedDynamicToken);
      if (payload && payload.exp && (payload.exp * 1000 - Date.now() > 60 * 1000)) {
        return cachedDynamicToken;
      }
    } catch (_) {}
  }

  // Fetch Logon credentials and custom config from DB or env
  let username = 'VOGA PARK';
  let password = 'Voga@123';
  const rawToken = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';

  try {
    const userRow = db.prepare("SELECT valor FROM app_config WHERE chave = 'LOGON_USERNAME'").get() as { valor: string } | undefined;
    if (userRow && userRow.valor && userRow.valor.trim() && !isPlaceholder(userRow.valor)) {
      username = userRow.valor.trim();
    }
  } catch (_) {}

  try {
    const passRow = db.prepare("SELECT valor FROM app_config WHERE chave = 'LOGON_PASSWORD'").get() as { valor: string } | undefined;
    if (passRow && passRow.valor && passRow.valor.trim() && !isPlaceholder(passRow.valor)) {
      password = passRow.valor.trim();
    }
  } catch (_) {}

  let cleanNak = rawToken.trim();
  if (cleanNak.toUpperCase().startsWith('NAK ')) {
    cleanNak = cleanNak.substring(4).trim();
  } else if (cleanNak.toUpperCase().startsWith('BEARER ')) {
    cleanNak = cleanNak.substring(7).trim();
  }

  if (!cleanNak) {
    console.error("DMP Client: Nenhum NAK ou Autenticação configurada. Logon impossível.");
    return null;
  }

  const authHeader = `NAK ${cleanNak}`;
  const baseUrl = getBaseUrl(); // ends with e.g. /itk/api/v1/
  const logonUrl = `${baseUrl}Logon?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&culture=pt-BR`;

  console.log(`DMP Client: Efetuando Logon dinâmico no portal com o usuário "${username}"...`);
  try {
    const response = await axios.get(logonUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      timeout: getTimeout()
    });

    const data = response?.data;
    const token = data?.access_token || data?.token || data?.accessToken;

    if (token) {
      console.log(`DMP Client: Logon realizado com sucesso! Novo Bearer Token obtido: ${token.substring(0, 15)}...`);
      cachedDynamicToken = token;
      lastTokenFetchTime = Date.now();
      return token;
    } else {
      console.error("DMP Client: Resposta do logon recebida, mas nenhum access_token foi encontrado no payload:", JSON.stringify(data));
    }
  } catch (err: any) {
    const status = err.response?.status;
    const body = typeof err.response?.data === 'string' ? err.response.data : JSON.stringify(err.response?.data || '');
    console.error(`DMP Client: Erro ao realizar Logon dinâmico (status=${status}): ${err.message}. Corpo: ${body}`);
  }

  return null;
}

const getBaseUrl = () => {
  const staticToken = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
  
  // REGRA DE SEGMENTO 1: Se o usuário está usando o token integrador estático ("DMP_ACCESS_TOKEN"),
  // o segmento correto a bater é SEMPRE o de integrador ("itk") e nunca o segmento corporativo ("trk/ext").
  // Isso se deve ao fato de que o token TOTVS do usuário falha silenciosamente caso bata no portal de trk/ext.
  if (staticToken.trim().length > 10) {
    const rawSegment = process.env.URL_SEGMENT;
    const customSegment = (rawSegment && !isPlaceholder(rawSegment)) ? rawSegment : 'itk';
    return `https://dmpaccess.dimep-ams.com.br/${customSegment.trim().replace(/^\/+|\/+$/g, '')}/api/v1/`;
  }

  let baseUrl = process.env.BASE_URL || process.env.BASE_URL_API || '';
  if (baseUrl) {
    baseUrl = baseUrl.trim().replace(/^['"]|['"]$/g, '');
  }

  if (baseUrl.toLowerCase().includes('dimep-ass.com.br')) {
    baseUrl = baseUrl.replace(/dimep-ass\.com\.br/gi, 'dmpaccess.dimep-ams.com.br');
    baseUrl = baseUrl.replace(/dmpaccess\.dmpaccess/gi, 'dmpaccess');
  }

  if (isPlaceholder(baseUrl) || (!baseUrl.toLowerCase().includes('.') && !baseUrl.toLowerCase().includes('localhost') && !baseUrl.toLowerCase().includes('127.0.0.1'))) {
    baseUrl = 'https://dmpaccess.dimep-ams.com.br';
  }
  
  if (baseUrl && !baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }

  let cleanBase = baseUrl;
  let detectedSegment = '';

  try {
    const urlObj = new URL(baseUrl);
    if (urlObj.hostname.toLowerCase() === 'dmpaccess.dimep-ass.com.br') {
      urlObj.hostname = 'dmpaccess.dimep-ams.com.br';
    }
    
    let pathname = urlObj.pathname;
    const apiV1Index = pathname.toLowerCase().indexOf('/api/v1');
    
    if (apiV1Index !== -1) {
      detectedSegment = pathname.substring(0, apiV1Index);
      if (detectedSegment.startsWith('/')) detectedSegment = detectedSegment.substring(1);
      if (detectedSegment.endsWith('/')) detectedSegment = detectedSegment.slice(0, -1);
      cleanBase = `${urlObj.protocol}//${urlObj.host}`;
    } else {
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      if (pathname.toLowerCase().endsWith('/login')) {
        pathname = pathname.substring(0, pathname.length - 6);
      }
      cleanBase = `${urlObj.protocol}//${urlObj.host}`;
      detectedSegment = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    }
  } catch (e) {}

  if (!detectedSegment) {
    detectedSegment = isPlaceholder(process.env.URL_SEGMENT) ? 'itk' : process.env.URL_SEGMENT!.trim();
  }

  detectedSegment = detectedSegment.replace(/^\/+|\/+$/g, '');

  try {
    const finalBaseUrl = `${cleanBase}/${detectedSegment}/api/v1/`;
    new URL(finalBaseUrl);
    return finalBaseUrl;
  } catch (e) {
    return 'https://dmpaccess.dimep-ams.com.br/itk/api/v1/';
  }
};

const createClient = () => {
  const rawToken = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
  let tokenStr = rawToken.trim();
  const prefix = 'Bearer';

  if (tokenStr.toUpperCase().startsWith('NAK ')) {
    tokenStr = tokenStr.substring(4).trim();
  } else if (tokenStr.toUpperCase().startsWith('NAK')) {
    tokenStr = tokenStr.substring(3).trim();
  } else if (tokenStr.toUpperCase().startsWith('BEARER ')) {
    tokenStr = tokenStr.substring(7).trim();
  } else if (tokenStr.toUpperCase().startsWith('BEARER')) {
    tokenStr = tokenStr.substring(6).trim();
  }

  if (tokenStr && isTokenExpired(tokenStr)) {
    console.error('DMP Client: ALERTA - O Token JWT configurado encontra-se expirado!');
  }

  const baseURL = getBaseUrl();
  console.log(`DMP Client: Inicializando Axios com baseURL: ${baseURL}`);

  const client = axios.create({
    baseURL: baseURL,
    timeout: getTimeout(),
    headers: {
      'Authorization': `${prefix} ${tokenStr}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  client.interceptors.request.use(async (config) => {
    try {
      const dynamicToken = await fetchDynamicTokenIfNeeded();
      if (dynamicToken) {
        config.headers['Authorization'] = `Bearer ${dynamicToken}`;
      } else {
        const raw = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
        let clean = raw.trim();
        if (clean.toUpperCase().startsWith('NAK ')) clean = clean.substring(4).trim();
        else if (clean.toUpperCase().startsWith('NAK')) clean = clean.substring(3).trim();
        else if (clean.toUpperCase().startsWith('BEARER ')) clean = clean.substring(7).trim();
        else if (clean.toUpperCase().startsWith('BEARER')) clean = clean.substring(6).trim();
        
        config.headers['Authorization'] = `Bearer ${clean}`;
      }
    } catch (interceptorError) {
      console.error('Request interceptor headers error:', interceptorError);
    }

    const currentBaseUrl = getBaseUrl();
    if (config.baseURL !== currentBaseUrl) {
      config.baseURL = currentBaseUrl;
    }
    
    return config;
  }, (error) => {
    return Promise.reject(error);
  });

  // INTERCEPTOR DE RESPOSTA EXTRAORDINÁRIO:
  // Detecta e trata redirecionamento HTML silencioso gerado pelo IIS quando o Token falha na autenticação,
  // levantando imediatamente um erro de Axios adequado para que o retry ou os logs tratem como erro de login real.
  client.interceptors.response.use((response) => {
    const contentType = String(response.headers['content-type'] || '');
    const bodyStr = typeof response.data === 'string' ? response.data : '';
    
    if (contentType.includes('text/html') || bodyStr.startsWith('<!DOCTYPE') || bodyStr.startsWith('<html')) {
      const authErrorMsg = "Autenticação falhou: A API da Dimep retornou uma página de portal Web HTML em vez de dados JSON. O token de acesso está provavelmente expirado ou sem autorização.";
      const error = new Error(authErrorMsg) as any;
      error.response = response;
      error.isAxiosError = true;
      error.config = response.config;
      return Promise.reject(error);
    }
    return response;
  }, (error) => {
    return Promise.reject(error);
  });

  axiosRetry(client, { 
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
             error.response?.status === 401 || 
             (error.response?.status ?? 0) >= 500;
    }
  });

  return client;
};

// Lazy initialization wrapper to allow process.env to populate first
let _client: ReturnType<typeof createClient> | null = null;
export const getDmpClient = () => {
  if (!_client) _client = createClient();
  return _client;
};

export const clientes_api = {
  // Coletamos o Pointer padrão do ambiente ou usamos o informado pelo usuário
  getPointer() {
    // 1. Check custom override configuration in SQLite first
    try {
      const row = db.prepare("SELECT valor FROM app_config WHERE chave = 'POINTER_CNPJ'").get() as { valor: string } | undefined;
      if (row && row.valor && row.valor.trim() && !isPlaceholder(row.valor)) {
        return row.valor.trim();
      }
    } catch (_) {}

    // 2. Prioritize explicit POINTER_CNPJ in env if configured and not placeholder
    const val = process.env.POINTER_CNPJ;
    if (val && !isPlaceholder(val)) {
      return val.trim();
    }

    // 3. Fallback to JWT nameid claim
    try {
      const rawToken = cachedDynamicToken || process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
      if (rawToken) {
        const payload = getJwtPayload(rawToken);
        if (payload && payload.nameid && !isPlaceholder(payload.nameid)) {
          console.log(`DMP Client: Auto-detected CNPJ client pointer from JWT claims: ${payload.nameid}`);
          return payload.nameid.trim();
        }
      }
    } catch (_) {}

    // 3. Absolute fallback default CNPJ
    return '32757781000150';
  },

  // Coleta Incremental
  // pointerParam: ID do último registro coletado ou CNPJ se for a primeira vez/coleta total
  async getAccessLogsByPointer(pointerParam?: string | number, logType?: string) {
    let pId: string | number = '0';
    if (pointerParam !== undefined && pointerParam !== null && pointerParam !== '' && pointerParam !== 0 && pointerParam !== '0') {
      pId = pointerParam;
    } else {
      try {
        const row = db.prepare("SELECT valor FROM app_config WHERE chave = 'POINTER_CNPJ'").get() as { valor: string } | undefined;
        if (row && row.valor && row.valor.trim() && !isPlaceholder(row.valor)) {
          const trimmed = row.valor.trim();
          if (/^\d+$/.test(trimmed) && trimmed.length < 10) {
            pId = trimmed;
          }
        }
      } catch (_) {}
    }
    
    let url = `AccessLog/Pointer/${pId}`;
    if (logType) url += `/${logType}`;
    
    console.log(`DMP Client: Requisitando logs incrementais com ponteiro de transação: ${pId}`);
    const res = await getDmpClient().get(url);
    return res.data;
  },

  // Consulta por Período
  async getAccessLogsByPeriod(fromY: string, fromM: string, fromD: string, toY: string, toM: string, toD: string, logType: string) {
    const pId = this.getPointer();
    const res = await getDmpClient().get(`AccessLog/${fromY}/${fromM}/${fromD}/${toY}/${toM}/${toD}/${logType}/Pointer/${pId}`);
    return res.data;
  },

  // Consulta por Pessoa
  async getAccessLogsByPerson(registration: string, y: string, m: string, d: string, integratePoint?: string) {
    const pId = this.getPointer();
    let url = `AccessLog/${registration}/${y}/${m}/${d}`;
    if (integratePoint) url += `/${integratePoint}`;
    url += `/Pointer/${pId}`;
    const res = await getDmpClient().get(url);
    return res.data;
  },

  // Dados de Pessoas
  async getPersonByRegistration(registrationNumber: string) {
    const pId = this.getPointer();
    try {
      const res = await getDmpClient().get(`Person/${registrationNumber}/Pointer/${pId}`);
      if (Array.isArray(res.data) && res.data.length > 0) return res.data[0];
      return res.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  async getBasicPersonsData() {
    const res = await getDmpClient().get('Person/BasicData');
    return res.data;
  }
};
