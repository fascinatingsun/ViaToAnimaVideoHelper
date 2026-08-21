const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const prompt = 'A cinematic sunrise over a mountain lake, image E2E test';

async function checkImage(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await axios.head(url, { timeout: 60000 });
      const contentType = response.headers['content-type'] || '';
      if (response.status !== 200 || !contentType.startsWith('image/')) {
        throw new Error(`Expected an image response, received ${response.status} ${contentType}`);
      }
      return contentType;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`Image check attempt ${attempt} failed; retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  console.log('Pollinations E2E: Testing against', API_BASE);
  const response = await axios.post(`${API_BASE}/api/generate-image`, { prompt });
  const result = response.data;

  if (result.provider !== 'pollinations') throw new Error('Unexpected image provider');
  if (!result.imageUrl || !result.imageUrl.startsWith('https://image.pollinations.ai/prompt/')) {
    throw new Error('Invalid Pollinations image URL');
  }
  if (!result.imageUrl.includes(encodeURIComponent(prompt))) {
    throw new Error('Prompt was not encoded into the image URL');
  }

  const contentType = await checkImage(result.imageUrl);
  console.log('Pollinations E2E: Image verified:', contentType);
  console.log('Pollinations E2E: Passed');
}

main().catch(error => {
  console.error('Pollinations E2E: Failed:', error.response?.data || error.message);
  process.exit(1);
});
