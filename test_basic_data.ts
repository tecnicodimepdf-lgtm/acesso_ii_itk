import dotenv from 'dotenv';
dotenv.config({ override: true });
import axios from 'axios';

const token = (process.env.DMP_ACCESS_TOKEN || '').trim();
const pid = '61099008003671';

async function testUrl(suffix: string) {
  const url = `https://dmpaccess.dimep-ams.com.br/itk/api/v1/${suffix}`;
  try {
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    console.log(`🎉 [SUCCESS] Suffix: ${suffix} -> Status: ${res.status}`);
    console.log(`  Body (truncated):`, JSON.stringify(res.data).substring(0, 300));
  } catch (e: any) {
    const status = e.response?.status;
    const errorBody = typeof e.response?.data === 'string' ? e.response.data : JSON.stringify(e.response?.data);
    console.log(`❌ [FAILED] Suffix: ${suffix} -> Status: ${status} | Body: ${errorBody?.substring(0, 200)}`);
  }
}

async function run() {
  console.log(`Testing with DMP_ACCESS_TOKEN prefix...`);
  
  const suffixes = [
    'Person/BasicData',
    `Person/BasicData/Pointer/${pid}`,
    `Person/BasicData/${pid}`,
    `Person/Pointer/${pid}`,
    `Person/BasicData?pointer=${pid}`,
    `Person?pointer=${pid}`
  ];

  for (const s of suffixes) {
    await testUrl(s);
  }
}

run();
