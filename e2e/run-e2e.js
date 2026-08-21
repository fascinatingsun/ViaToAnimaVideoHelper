const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';

async function main() {
  console.log('E2E: Starting tests against', API_BASE);

  // 1) Upload
  const form = new FormData();
  const samplePath = 'test-audio.txt';
  if (!fs.existsSync(samplePath)) {
    console.error('Sample audio file not found:', samplePath);
    process.exit(2);
  }
  form.append('audio', fs.createReadStream(samplePath));

  console.log('E2E: Uploading sample audio...');
  const uploadResp = await axios.post(`${API_BASE}/api/upload`, form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }).then(r => r.data).catch(err => { console.error('Upload failed:', err.message); process.exit(3); });
  console.log('E2E: Uploaded ->', uploadResp.filename || uploadResp.url);

  // 2) Analyze
  console.log('E2E: Calling /api/analyze...');
  const analyzeResp = await axios.post(`${API_BASE}/api/analyze`, { path: uploadResp.path }).then(r => r.data).catch(err => { console.error('Analyze failed:', err.message); process.exit(4); });
  console.log('E2E: Analyze returned plan steps:', (analyzeResp.plan || []).length);

  if (!Array.isArray(analyzeResp.plan) || analyzeResp.plan.length === 0) {
    console.error('E2E: No plan produced by analyze');
    process.exit(5);
  }

  // 3) For each step, generate prompt and image
  for (const step of analyzeResp.plan) {
    console.log(`E2E: Generating prompt for step ${step.id}...`);
    const promptResp = await axios.post(`${API_BASE}/api/generate-prompt`, { stepText: step.summary || step.title, transcription: analyzeResp.transcription, analysis: analyzeResp.analysis }).then(r => r.data).catch(err => { console.error('Generate-prompt failed:', err.message); process.exit(6); });
    console.log('E2E: Prompt:', promptResp.prompt ? promptResp.prompt.slice(0, 200) : '<none>');
    if (!promptResp.usedGemini) {
      console.error('E2E: generate-prompt did not use Gemini (usedGemini=false). Failing test.');
      process.exit(10);
    }

    console.log(`E2E: Generating image for step ${step.id}...`);
    const imageResp = await axios.post(`${API_BASE}/api/generate-image`, { prompt: promptResp.prompt, style: null }).then(r => r.data).catch(err => { console.error('Generate-image failed:', err.message); process.exit(7); });
    console.log('E2E: Image URL:', imageResp.imageUrl);
    if (imageResp.provider !== 'pollinations' || !imageResp.imageUrl) {
      console.error('E2E: Image generation returned an invalid Pollinations response');
      process.exit(8);
    }

    let imageCheck;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        imageCheck = await axios.head(imageResp.imageUrl, { timeout: 60000 });
        break;
      } catch (err) {
        if (attempt === 3) {
          console.error('E2E: Generated image URL failed after retries:', err.message);
          process.exit(11);
        }
        console.log(`E2E: Image check attempt ${attempt} failed; retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const contentType = imageCheck.headers['content-type'] || '';
    if (imageCheck.status !== 200 || !contentType.startsWith('image/')) {
      console.error('E2E: Generated URL did not return an image:', imageCheck.status, contentType);
      process.exit(12);
    }
    console.log('E2E: Pollinations image verified:', contentType);
  }

  console.log('E2E: All steps completed successfully');
  process.exit(0);
}

main().catch(err => {
  console.error('E2E: Unexpected error', err);
  process.exit(9);
});
