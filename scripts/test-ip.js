const express = require('express');
const app = express();

// Trust proxy setting
app.set('trust proxy', 1);

app.get('/test-ip', (req, res) => {
  const rawIp = req.ip || "";
  const normalized = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
  
  console.log('Raw IP:', rawIp);
  console.log('Normalized IP:', normalized);
  console.log('Headers:', req.headers);
  
  res.json({
    rawIp,
    normalized,
    headers: req.headers,
    isLocalhost: rawIp === '::1' || rawIp === '127.0.0.1' || normalized === '127.0.0.1'
  });
});

const port = 3001;
app.listen(port, () => {
  console.log(`IP test server running on port ${port}`);
  console.log(`Visit: http://localhost:${port}/test-ip`);
});
