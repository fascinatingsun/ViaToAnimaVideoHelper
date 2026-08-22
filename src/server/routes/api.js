const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINY_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_BASE = process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com';

const router = express.Router();

async function generateGeminiContent(text, history = []) {
  const url = `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const contents = history.length > 0 ? history : [{ role: 'user', parts: [{ text }] }];
  const body = { contents };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    } catch (error) {
      lastError = error;
      if (error.response && error.response.status < 500 && error.response.status !== 429) throw error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

function getGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

// Simple key presence check (does not expose the key)
router.get('/_key-check', (req, res) => {
  res.json({ hasKey: !!GEMINI_KEY });
});

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

router.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ ok: true, filename: req.file.filename, url: fileUrl, path: req.file.path });
});

// Analyze audio with Gemini (placeholder). Replace with actual API call using GEMINI_API_KEY
router.post('/analyze', async (req, res) => {
  const { path: audioPath } = req.body;
  if (!audioPath) return res.status(400).json({ error: 'audio path required' });

  const mockTranscription = 'This is a mocked transcription of the uploaded audio.';
  const mockAnalysis = {
    summary: 'Short summary of the audio content.',
    topics: ['topic A', 'topic B'],
    sentiment: 'neutral'
  };

  const generatedPrompt = `A cinematic, high-detail image inspired by: ${mockTranscription} -- focus on ${mockAnalysis.topics.join(', ')}`;

  // Create a mock plan: array of steps derived from analysis (for prototype)
  const plan = [
    { id: 1, title: 'Intro scene', summary: 'Introduce main theme', prompt: `${generatedPrompt} -- intro scene` , images: [] },
    { id: 2, title: 'Conflict scene', summary: 'Show conflict and tension', prompt: `${generatedPrompt} -- conflict scene`, images: [] },
    { id: 3, title: 'Resolution', summary: 'Resolve story visually', prompt: `${generatedPrompt} -- resolution`, images: [] }
  ];

  res.json({ transcription: mockTranscription, analysis: mockAnalysis, prompt: generatedPrompt, plan });
});

// Generate a prompt for an image from a step using Gemini (placeholder)
router.post('/generate-prompt', async (req, res) => {
  const { stepText, transcription, analysis } = req.body;
  if (!stepText && !transcription) return res.status(400).json({ error: 'stepText or transcription required' });

  const base = stepText || (transcription && transcription.slice(0, 120)) || 'Image';
  const system = `You are a creative image prompt generator. Produce one concise but descriptive image-generation prompt suitable for an image model. Keep it under 200 words and include visual details, mood, color palette, and composition.`;
  const userInput = `Create an image prompt for: "${base}". Analysis topics: ${(analysis && analysis.topics) ? analysis.topics.join(', ') : 'none'}.`;

  // If a Gemini API key is provided, call the Generative Language API, otherwise return a local fallback
  if (GEMINI_KEY) {
    try {
      const r = await generateGeminiContent(`${system}\n\n${userInput}`);
      const prompt = getGeminiText(r.data) || JSON.stringify(r.data).slice(0, 1000);
      return res.json({ ok: true, prompt, usedGemini: true });
    } catch (err) {
      console.error('Gemini generate error:', err?.response?.data || err.message);
      // fallthrough to local fallback
    }
  }

  const prompt = `Detailed cinematic illustration of: ${base} -- include themes: ${(analysis && analysis.topics) ? analysis.topics.join(', ') : 'general'} -- high detail, dramatic lighting`;
  res.json({ ok: true, prompt, usedGemini: false });
});

// Direct Gemini chat endpoint: forwards `message` to Gemini and returns raw response or error
router.post('/gemini-chat', async (req, res) => {
  const { message, history } = req.body;
  const sessionId = req.get('X-Session-ID') || req.body.sessionId || null;
  if (!message) return res.status(400).json({ error: 'message required' });
  if (!GEMINI_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY not configured on server' });

  const previousContents = Array.isArray(history) ? history : [];
  const contents = [...previousContents, { role: 'user', parts: [{ text: message }] }];

  try {
    console.log(`Gemini chat request: session ${sessionId || 'unknown'}`);
    const r = await generateGeminiContent(message, contents);
    // Return the provider response body as-is
    return res.status(200).json({ ...r.data, sessionId });
  } catch (err) {
    // If the provider returned an HTTP error, forward its status and body so client can read raw error
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    // Network or other error
    return res.status(500).json({ error: err.message });
  }
});

// Build a Pollinations image URL. Pollinations does not require an API key.
router.post('/generate-image', async (req, res) => {
  const { prompt, style } = req.body;
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'prompt required' });

  const styleText = style && style.name ? `, ${style.name} style` : '';
  const finalPrompt = `${prompt.trim()}${styleText}`;
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&safe=true`;
  res.json({ ok: true, imageUrl, prompt: finalPrompt, provider: 'pollinations' });
});

module.exports = router;
