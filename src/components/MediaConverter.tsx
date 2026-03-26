import React, { useState } from 'react';
import { Video, Music, Download, Loader2, Youtube, AlertCircle } from 'lucide-react';

interface VideoInfo {
  title: string;
  thumbnail: string;
  author: string;
}

export function MediaConverter() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  const fetchInfo = async () => {
    if (!url) {
      setError('Por favor, insira uma URL do YouTube.');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch(`/api/youtube/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao buscar informações do vídeo.');
      }

      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao buscar o vídeo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-8 bg-[#2a204a]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Youtube size={28} className="text-red-500" />
          YouTube Downloader
        </h1>
        <p className="text-sm text-gray-400">
          Baixe vídeos ou áudios diretamente do YouTube colando a URL abaixo.
        </p>
      </div>

      <div className="max-w-4xl space-y-8">
        <div className="bg-[#1e1536] rounded-2xl border border-white/10 p-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Youtube className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
                placeholder="Cole o link do YouTube aqui (ex: https://www.youtube.com/watch?v=...)"
                className="block w-full pl-11 pr-4 py-4 bg-[#151025] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              onClick={fetchInfo}
              disabled={loading || !url}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Buscar
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {videoInfo && (
          <div className="bg-[#1e1536] rounded-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-2/5 relative bg-black">
                <img 
                  src={videoInfo.thumbnail} 
                  alt={videoInfo.title} 
                  className="w-full h-full object-cover aspect-video md:aspect-auto opacity-90"
                />
              </div>
              
              <div className="p-8 md:w-3/5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white line-clamp-2 mb-3 leading-tight">
                    {videoInfo.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-8 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      <Youtube size={12} className="text-gray-300" />
                    </span>
                    {videoInfo.author}
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="w-full h-[60px] rounded-xl overflow-hidden shadow-lg shadow-blue-900/20">
                    <iframe 
                      style={{ width: '100%', height: '60px', border: 0, overflow: 'hidden' }} 
                      scrolling="no" 
                      src={`https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=1080&color=2563eb`}
                      title="Download Video"
                    ></iframe>
                  </div>
                  
                  <div className="w-full h-[60px] rounded-xl overflow-hidden shadow-lg shadow-emerald-900/20">
                    <iframe 
                      style={{ width: '100%', height: '60px', border: 0, overflow: 'hidden' }} 
                      scrolling="no" 
                      src={`https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=mp3&color=059669`}
                      title="Download Audio"
                    ></iframe>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
