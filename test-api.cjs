const https = require('https');

const data = JSON.stringify({
  model: "google/gemma-4-31b-it",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCABQAFADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAaEAACAwEBAAAAAAAAAAAAAAAAAQIDBAUG/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAXEQEBAQEAAAAAAAAAAAAAAAAAAREh/9oADAMBAAIRAxEAPwA9kAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//2Q==" }
        },
        {
          type: "text",
          text: "What is this?"
        }
      ]
    }
  ],
  max_tokens: 16384,
  temperature: 1.00,
  top_p: 0.95,
  stream: false,
  chat_template_kwargs: { enable_thinking: true }
});

const options = {
  hostname: 'integrate.api.nvidia.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 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',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
