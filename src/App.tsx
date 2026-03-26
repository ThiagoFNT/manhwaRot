import React, { useState } from 'react';
import { SrtTools } from './components/SrtTools';
import { ScriptCreator } from './components/ScriptCreator';
import { MediaConverter } from './components/MediaConverter';
import { FileText, Zap, Download } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'srt' | 'script' | 'media'>('script');

  return (
    <div className="flex h-screen bg-[#1e1536] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#150e26] border-r border-white/5 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Manhwa Tools
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setActiveTab('srt')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'srt' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={18} />
            Ferramentas SRT
          </button>
          
          <button
            onClick={() => setActiveTab('script')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'script' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap size={18} />
            Criador de Roteiro
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'media' 
                ? 'bg-purple-500/20 text-purple-400' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Download size={18} />
            Baixar Mídia
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'srt' && <SrtTools />}
        {activeTab === 'script' && <ScriptCreator />}
        {activeTab === 'media' && <MediaConverter />}
      </main>
    </div>
  );
}
