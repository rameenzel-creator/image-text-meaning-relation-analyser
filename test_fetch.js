const apiKey = "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";

async function testApi() {
  console.log("Starting API test...");
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it",
        messages: [
          {
            role: "user",
            content: "Hello! Reply with 'Hello' and nothing else."
          }
        ],
        max_tokens: 50,
        temperature: 0.7,
        stream: false,
        chat_template_kwargs: { enable_thinking: false }
      })
    });
    
    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

testApi();
