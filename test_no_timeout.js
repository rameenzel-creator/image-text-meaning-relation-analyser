async function test(key) {
  console.log(`Testing key: ${key.substring(0, 10)}...`);
  try {
    const startTime = Date.now();
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
      })
    });
    console.log(`Status: ${response.status} (took ${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
    const body = await response.text();
    console.log("Body:", body);
  } catch (err) {
    console.error("Error details:", err);
  }
}

test("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");
