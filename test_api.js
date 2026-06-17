import https from 'https';

const API_KEY = "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";

const data = JSON.stringify({
  model: "google/gemma-4-31b-it",
  messages: [
    { role: "user", content: "Hello, reply with 'test' and nothing else." }
  ],
  max_tokens: 100,
  temperature: 1.00,
  top_p: 0.95,
  stream: false,
  chat_template_kwargs: { enable_thinking: false }
});

const options = {
  hostname: 'integrate.api.nvidia.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf-8');
  let body = '';
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', e => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
