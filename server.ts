import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import path from 'path';
import fetch from 'node-fetch';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/youtube/info', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url || !url.includes('youtu')) {
        return res.status(400).json({ error: 'URL do YouTube inválida' });
      }
      
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'Vídeo não encontrado ou privado.' });
        }
        throw new Error(`Status code: ${response.status}`);
      }
      
      const info = await response.json() as any;
      
      res.json({
        title: info.title,
        thumbnail: info.thumbnail_url,
        author: info.author_name,
      });
    } catch (error) {
      console.error('Error fetching YouTube info:', error);
      res.status(500).json({ error: 'Falha ao obter informações do vídeo.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
