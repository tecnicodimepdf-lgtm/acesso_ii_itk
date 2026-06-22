import dotenv from 'dotenv';
dotenv.config({ override: true });
import axios from 'axios';

async function testLogTypes() {
  const token = (process.env.DMP_ACCESS_TOKEN || '').trim();
  const base = "https://dmpaccess.dimep-ams.com.br/itk/api/v1/AccessLog/Pointer";
  
  // Let's test with pointer ID 1 and also pointer ID 61099008003671
  const ptrs = ["1", "61099008003671"];
  const logTypes = ["0", "1", "2", "all", "Acesso", "AccessLog"];

  for (const ptr of ptrs) {
    for (const lt of logTypes) {
      const url = `${base}/${ptr}/${lt}`;
      try {
        const res = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 4000
        });
        console.log(`🎉 [SUCCESS] URL: ${url} | Status: ${res.status} | Data length:`, Array.isArray(res.data) ? res.data.length : typeof res.data);
      } catch (e: any) {
        const status = e.response?.status;
        const body = typeof e.response?.data === 'string' ? e.response.data : JSON.stringify(e.response?.data);
        console.log(`❌ [FAILED] URL: ${url} | Status: ${status} | Body: ${body?.substring(0, 100)}`);
      }
    }
  }
}

testLogTypes();
