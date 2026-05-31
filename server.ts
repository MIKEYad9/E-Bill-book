/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = 3000;

// High limits to allow Base64 image payload uploads for OCR
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

// Initialize the GoogleGenAI client lazy-style
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      console.warn("WARNING: GEMINI_API_KEY is not configured or still set to default placeholder.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -------------------------------------------------------------
// API Routes (First priority)
// -------------------------------------------------------------

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  });
});

// AI OCR & Bill parsing endpoint
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided. Please upload a valid invoice image.' });
    }

    const ai = getAiClient();
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'Gemini API is not configured. Please add GEMINI_API_KEY to your secrets settings or .env file.'
      });
    }

    // Clean base64 string if it contains HTML/Data URLs headings
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const systemInstruction = 
      "You are an expert OCR parser specialized in parsing Indian clothing retail purchase and sales bills. " +
      "Analyze the uploaded invoice image. Extract all clothing items found in the main item table/description, along with billing details. " +
      "For each clothing item, identify its name (e.g. Kurti, Jeans, Saree), its categorized type, its size (e.g. XL, M, 32, S, L, Free Size) if mentioned, " +
      "quantity, and rate/price. Also extract overall fields like customer name and shop name if readable. " +
      "Return ONLY the requested JSON structure. If fields like category or size cannot be detected, provide common placeholders or wildcards.";

    const prompt = "Please scan this fashion retail invoice, analyze description, prices, and quantities, and parse into structured JSON format.";

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shopName: { type: Type.STRING, description: "Shop name if listed on the bill" },
            customerName: { type: Type.STRING, description: "Customer name if listed" },
            customerPhone: { type: Type.STRING, description: "Customer mobile number if list" },
            items: {
              type: Type.ARRAY,
              description: "Array of inventory items processed from the invoice table",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name/description of clothing/apparel item" },
                  category: { type: Type.STRING, description: "Generic clothing classification (e.g. Saree, Kurta, Jeans, Shirt, T-Shirt, Suit, Traditional)" },
                  size: { type: Type.STRING, description: "Apparel standard physical size (e.g. M, L, XL, 38, 42) or 'Free' if not mentioned" },
                  quantity: { type: Type.NUMBER, description: "Numerical item count" },
                  rate: { type: Type.NUMBER, description: "Base rate or listing price per unit" },
                  discountPercent: { type: Type.NUMBER, description: "Indicated discount on item as a percentage" },
                  gstPercent: { type: Type.NUMBER, description: "GST rate on clothing if individual tax columns are shown" }
                },
                required: ["name", "quantity", "rate"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error('Emply response returned from Gemini OCR analyzer.');
    }

    const ocrData = JSON.parse(parsedText.trim());
    return res.json({ success: true, data: ocrData });

  } catch (error: any) {
    console.error('OCR Extraction Endpoint Error:', error);
    return res.status(500).json({
      error: 'Failed to extract list from image.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// AI Insights & Analytics assistant
app.post('/api/assistant', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt query.' });
    }

    const ai = getAiClient();
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'Gemini API not configured. Set up the API key to activate AI Assistant Insights.'
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `You are an AI Sales Business Mentor for an Indian fashion/clothing boutique shop owner. Give strategic insights, recommendations, or voice-prompted results based on the query and store data provided below. Keep your advice short (max 100 words), highly actionable, and tailored to Indian retail markets (Saree, Dupatta, Wedding Season, Kurta trends). Include regional terms if appropriate.

Store Context Data:
${JSON.stringify(context || {})}

User Query:
"${prompt}"`
    });

    return res.json({ response: response.text });
  } catch (error: any) {
    console.error('AI Assistant Endpoint Error:', error);
    return res.status(500).json({
      error: 'AI assistant is temporarily unavailable.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// -------------------------------------------------------------
// Vite Dev server setup (or serving client dist for prod)
// -------------------------------------------------------------

async function initializeApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development server loaded as middleware');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static build from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Retail Billing system is listening on http://0.0.0.0:${PORT}`);
  });
}

initializeApp().catch((err) => {
  console.error('App init failed:', err);
});
