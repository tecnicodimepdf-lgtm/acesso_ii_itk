import dotenv from 'dotenv';
dotenv.config({ override: true });

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e: any) {
    return null;
  }
}

const token = process.env.DMP_ACCESS_TOKEN || '';
console.log("Token length:", token.length);
if (token.length > 20) {
  const parsed = parseJwt(token);
  console.log("Decoded JWT Payload:", JSON.stringify(parsed, null, 2));
} else {
  console.log("Token not long enough or missing!");
}
