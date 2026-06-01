import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Gemini API Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
}

// REST route for chatting with Gemini
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!ai) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }
    
    const chatConfig = {
      systemInstruction: "Anda adalah AI Asisten Akademik untuk S1 Manajemen Pendidikan Agama Islam (MPAI) di Portal Study Cove. " +
                         "Bantu mahasiswa memahami materi perkuliahan, teori administrasi pendidikan, metodologi penelitian, " +
                         "konsep pendidikan islam, manajemen kepemimpinan, evaluasi kurikulum, dan tugas akademik lainnya. " +
                         "Berikan jawaban yang ramah, sopan, mengedukasi, terstruktur, dan sepenuhnya dalam Bahasa Indonesia yang baik.",
    };
    
    // Reconstruct the academic chat context
    const chatHistoryContext = (history || [])
      .map((h: any) => `${h.role === 'user' ? 'Mahasiswa' : 'Asisten'}: ${h.text}`)
      .join('\n');
      
    const formattedPrompt = `${chatHistoryContext}\nMahasiswa: ${message}\nAsisten:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedPrompt,
      config: chatConfig,
    });
    
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini server error:", error);
    res.status(500).json({ error: error?.message || "Internal server error during Gemini completion." });
  }
});

async function startServer() {
  const PORT = 3000;

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
