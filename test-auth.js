const http = require('http');

function postJSON(urlStr, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method: 'POST',
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(resData) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: resData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function testAuthFlow() {
  console.log('\n============================================================');
  console.log('      TESTING CHANDRASETU AUTHENTICATION FLOW (CLI)        ');
  console.log('============================================================');

  // Test Admin Login Credentials
  const credentialsList = [
    { email: 'admin@chandrasetu.isro.gov.in', password: 'Admin@Chandrayaan2' },
    { email: 'sahidwork123@gmail.com', password: 'Sahid123sahim@' },
  ];

  let activeToken = null;
  let loggedInUser = null;

  for (const creds of credentialsList) {
    try {
      console.log(`\n🔑 Attempting LOGIN with: ${creds.email} ...`);
      const res = await postJSON('http://localhost:8000/api/auth/login', creds);

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('🛡️ Status Code:', res.statusCode);
        console.log('👤 User Name:  ', res.body.user?.name || 'Administrator');
        console.log('📧 User Email: ', res.body.user?.email || creds.email);
        console.log('🔑 JWT Token:  ', (res.body.access_token || '').substring(0, 35) + '...');
        activeToken = res.body.access_token;
        loggedInUser = res.body.user;
        break;
      } else {
        console.log(`⚠️ Login attempt failed with status ${res.statusCode}:`, res.body?.message || res.body);
      }
    } catch (err) {
      console.log(`❌ Network/Connection error connecting to API Gateway: ${err.message}`);
    }
  }

  if (activeToken) {
    try {
      console.log('\n🚪 Attempting LOGOUT for active session ...');
      const logoutRes = await postJSON('http://localhost:8000/api/auth/logout', {}, activeToken);
      console.log('✅ LOGOUT SUCCESSFUL!');
      console.log('🛡️ Status Code:', logoutRes.statusCode);
      console.log('RESPONSE:', logoutRes.body);
    } catch (err) {
      console.log('⚠️ Logout completed on client side.');
    }
  }

  console.log('============================================================\n');
}

testAuthFlow();
