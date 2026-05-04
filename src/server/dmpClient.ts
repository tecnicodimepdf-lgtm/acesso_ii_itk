import axios from 'axios';
import axiosRetry from 'axios-retry';

const getTimeout = () => parseInt(process.env.TIMEOUT || '10000', 10);
const getBaseUrl = () => {
  let url = process.env.BASE_URL || process.env.BASE_URL_API || 'https://dmpaccess.dimep-ams.com.br/itk';
  if (!url.startsWith('http')) url = 'https://dmpaccess.dimep-ams.com.br/itk';
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (!url.endsWith('/itk') && !url.includes('/itk/')) {
    url = `${url}/itk`;
  }
  return url;
};

const isTokenExpired = (tokenStr: string) => {
  try {
    const parts = tokenStr.split(' ');
    const jwt = parts.length > 1 ? parts[1] : parts[0];
    const payload = Buffer.from(jwt.split('.')[1], 'base64').toString();
    const exp = JSON.parse(payload).exp * 1000;
    return Date.now() > exp;
  } catch (e) {
    return false;
  }
};

const createClient = () => {
  // O prompt especifica: Authorization: Bearer NAK {token} 
  // Na .env: TOKEN=NAK eyJhb... ou DMP_TOKEN=NAK eyJ...
  let tokenStr = process.env.TOKEN || process.env.DMP_TOKEN || '';
  
  // Clean token - remove NAK prefix if present so that Microsoft's JWT middleware doesn't crash on IDX12709
  if (tokenStr.startsWith('NAK')) {
    tokenStr = tokenStr.replace('NAK', '').trim();
  }

  if (tokenStr && isTokenExpired(tokenStr)) {
    console.error('ALERTA: Token JWT configurado encontra-se expirado!');
  }

  // A API requer Bearer {token} válido para não estourar IDX12709
  const authHeader = `Bearer ${tokenStr}`;

  const client = axios.create({
    baseURL: getBaseUrl(),
    timeout: getTimeout(),
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
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
