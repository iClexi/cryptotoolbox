
import fetch from 'node-fetch';

async function testRegister() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MichaelRobles20250845', pin: '1234' })
    });
    const data = await res.json();
    console.log('Register Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testRegister();
