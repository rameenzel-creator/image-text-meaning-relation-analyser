const apiKey = "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";

async function run() {
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    const data = await response.json();
    const gemmaModels = data.data.filter(m => m.id.toLowerCase().includes("gemma"));
    console.log("Gemma Models:");
    gemmaModels.forEach(m => console.log(`- ${m.id}`));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
