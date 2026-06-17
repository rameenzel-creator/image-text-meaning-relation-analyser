async function test(key) {
  console.log(`Testing key: ${key.substring(0, 10)}...`);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000); // 15s timeout
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
        chat_template_kwargs: { enable_thinking: false }
      }),
      signal: controller.signal
    });
    clearTimeout(id);
    console.log("Status:", response.status);
    const body = await response.text();
    console.log("Body:", body);
  } catch (err) {
    clearTimeout(id);
    console.error("Error details:", err.name, err.message, err.code);
  }
}

async function run() {
  await test("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");
  console.log("-----------------------");
  await test("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");
}

run();
