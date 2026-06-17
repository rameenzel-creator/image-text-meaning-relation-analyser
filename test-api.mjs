const apiKey = "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";

async function testApi() {
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
          { role: "system", content: "You are a helpful assistant." },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello!"
              }
            ]
          }
        ],
        max_tokens: 16384,
        temperature: 1.00,
        top_p: 0.95,
        stream: false,
        chat_template_kwargs: { enable_thinking: true }
      })
    });
    
    const data = await response.json();
    console.log("Response Text:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

testApi();
