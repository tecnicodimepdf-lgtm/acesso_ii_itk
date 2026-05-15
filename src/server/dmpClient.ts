import axios from 'axios';
import axiosRetry from 'axios-retry';

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

const getBaseUrl = (tokenStr?: string) => {
  let url = process.env.BASE_URL || process.env.BASE_URL_API || 'https://dmpaccess.dimep-ams.com.br';
  if (url.endsWith('/')) url = url.slice(0, -1);

  const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
  const hasPath = urlObj.pathname.length > 1;

  if (hasPath) return url;

  // O usuário solicitou explicitamente o prefixo /itk para a API
  return `${url}/itk`;
};

const createClient = () => {
  let tokenStr = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
  
  // Limpa o token - remove prefixos NAK ou Bearer se vierem do .env
  if (tokenStr.toUpperCase().startsWith('NAK')) {
    tokenStr = tokenStr.substring(3).trim();
  }
  // Also remove Bearer if it was doubled accidentally
  if (tokenStr.toUpperCase().startsWith('BEARER')) {
    tokenStr = tokenStr.substring(6).trim();
  }

  if (tokenStr && isTokenExpired(tokenStr)) {
    console.error('ALERTA: Token JWT configurado encontra-se expirado!');
  }

  const client = axios.create({
    baseURL: getBaseUrl(tokenStr),
    timeout: getTimeout(),
    headers: {
      'Authorization': `Bearer ${tokenStr}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  axiosRetry(client, { 
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      // Retry on network errors or 5xx or 401
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
  // Coleta Incremental
  async getAccessLogsByPointer(pointerId: number, logType?: string) {
    let url = `/api/v1/AccessLog/Pointer/${pointerId}`;
    if (logType) url += `/${logType}`;
    const res = await getDmpClient().get(url);
    return res.data; // Expected array of logs
  },

  // Consulta por Período
  async getAccessLogsByPeriod(fromY: string, fromM: string, fromD: string, toY: string, toM: string, toD: string, logType: string) {
    const res = await getDmpClient().get(`/api/v1/AccessLog/${fromY}/${fromM}/${fromD}/${toY}/${toM}/${toD}/${logType}`);
    return res.data;
  },

  // Consulta por Pessoa
  async getAccessLogsByPerson(registration: string, y: string, m: string, d: string, integratePoint?: string) {
    let url = `/api/v1/AccessLog/${registration}/${y}/${m}/${d}`;
    if (integratePoint) url += `/${integratePoint}`;
    const res = await getDmpClient().get(url);
    return res.data;
  },

  // Dados de Pessoas
  async getPersonByRegistration(registrationNumber: string) {
    try {
      const res = await getDmpClient().get(`/api/v1/Person/${registrationNumber}`);
      // The API returns an array of people or a single object. If array, return the first item.
      if (Array.isArray(res.data) && res.data.length > 0) return res.data[0];
      return res.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  async getBasicPersonsData() {
    const res = await getDmpClient().get('/api/v1/Person/BasicData');
    return res.data;
  }
};
