const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const firstMessage = 'Remember this project codename: Orion.';
const secondMessage = 'What is the project codename I asked you to remember?';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function waitForServer(url) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await axios.get(`${url}/api/_key-check`, { timeout: 500 });
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  let providerRequest;
  const provider = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      providerRequest = JSON.parse(body);
      const hasContext = providerRequest.contents.some(turn =>
        turn.role === 'user' && turn.parts?.some(part => part.text === firstMessage)
      ) && providerRequest.contents.some(turn =>
        turn.role === 'model' && turn.parts?.some(part => part.text === 'The codename is Orion.')
      );
      const answer = providerRequest.contents.length === 1
        ? 'The codename is Orion.'
        : (hasContext ? 'The codename is Orion.' : 'I do not have that context.');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer }] } }] }));
    });
  });

  let app;
  try {
    const providerPort = await listen(provider);
    const appPort = await new Promise((resolve, reject) => {
      const probe = http.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const port = probe.address().port;
        probe.close(() => resolve(port));
      });
      probe.once('error', reject);
    });
    const apiBase = `http://127.0.0.1:${appPort}`;
    app = spawn(process.execPath, ['index.js'], {
      cwd: require('path').resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(appPort), GEMINI_API_KEY: 'test-key', GEMINI_BASE: `http://127.0.0.1:${providerPort}` },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await waitForServer(apiBase);
    const first = await axios.post(`${apiBase}/api/gemini-chat`, { message: firstMessage, history: [] });
    const firstAnswer = first.data.candidates[0].content.parts[0].text;
    assert.strictEqual(firstAnswer, 'The codename is Orion.');

    const history = [
      { role: 'user', parts: [{ text: firstMessage }] },
      { role: 'model', parts: [{ text: firstAnswer }] }
    ];
    const second = await axios.post(`${apiBase}/api/gemini-chat`, { message: secondMessage, history });
    const secondAnswer = second.data.candidates[0].content.parts[0].text;
    assert.strictEqual(secondAnswer, 'The codename is Orion.');
    assert.strictEqual(providerRequest.contents.at(-1).parts[0].text, secondMessage);

    const audioForm = new FormData();
    audioForm.append('message', 'Analyze this audio in the context of our conversation.');
    audioForm.append('history', JSON.stringify(history));
    audioForm.append('sessionId', 'audio-test-session');
    audioForm.append('audio', fs.createReadStream(path.resolve(__dirname, '..', 'test-audio.txt')), {
      filename: 'test-audio.wav',
      contentType: 'audio/wav'
    });
    await axios.post(`${apiBase}/api/gemini-chat`, audioForm, { headers: audioForm.getHeaders() });
    const audioPart = providerRequest.contents.at(-1).parts.find(part => part.inline_data);
    assert.ok(audioPart, 'Gemini provider request did not include inline audio data');
    assert.strictEqual(audioPart.inline_data.mime_type, 'audio/wav');
    assert.ok(audioPart.inline_data.data.length > 0, 'Gemini provider request included empty audio data');
    console.log('Gemini session E2E: Passed; text context and audio upload were forwarded.');
  } finally {
    if (app) app.kill();
    provider.close();
  }
}

main().catch(error => {
  console.error('Gemini session E2E: Failed:', error.response?.data || error.message);
  process.exit(1);
});
