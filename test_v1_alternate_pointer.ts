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

async function run() {
  const token = getCleanToken();
  const pointerId = '61099008003671'; // native CNPJ in the JWT

  const testSuites = [
    { host: 'https://dmpaccess.dimep-ass.com.br', segment: 'itk' },
    { host: 'https://dmpaccess.dimep-ass.com.br', segment: 'trk/ext' },
    { host: 'https://dmpaccess.dimep-ams.com.br', segment: 'itk' },
    { host: 'https://dmpaccess.dimep-ams.com.br', segment: 'trk/ext' }
  ];

  for (const suite of testSuites) {
    const url = `${suite.host}/${suite.segment}/api/v1/AccessLog/Pointer/${pointerId}`;
    console.log(`\n------------------------------------------------------------`);
    console.log(`QUERYING: ${url}`);
    console.log(`------------------------------------------------------------`);

    try {
      const res = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log(`🎉 SUCCESS! Status: ${res.status}`);
      console.log(`Data count:`, Array.isArray(res.data) ? res.data.length : typeof res.data);
      console.log(`Data (truncated):`, JSON.stringify(res.data).substring(0, 300));
    } catch (e: any) {
      if (e.response) {
        console.log(`Failed! Status: ${e.response.status}`);
        console.log(`Error Response:`, JSON.stringify(e.response.data));
      } else {
        console.log(`Network/Other Error:`, e.message);
      }
    }
  }
}

run();
