import React, { useState, useRef, useEffect } from 'react';
import { Zap, Upload, FileText, Info, Diamond, Youtube, FileCode2, AlertCircle, ArrowLeft, Loader2, Check, Settings, BookOpen, Users, Plus, Trash2, X, Edit3, Mic, Copy, Download, RefreshCw, Search, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export function ScriptCreator() {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [srtContent, setSrtContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Edit Modal State
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editSearchText, setEditSearchText] = useState('');
  const [editReplaceText, setEditReplaceText] = useState('');
  const [editCaseSensitive, setEditCaseSensitive] = useState(false);
  const [isRephrasing, setIsRephrasing] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [editSelection, setEditSelection] = useState({ start: 0, end: 0, text: '' });

  interface Chapter {
    id: number;
    title: string;
    timeRange: string;
    originalText: string;
    wordCount: number;
    generatedScript: string;
    generatedWordCount?: number;
    isGenerating: boolean;
  }

  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Project Config State
  const [projectName, setProjectName] = useState('');
  const [chapterCount, setChapterCount] = useState<number | ''>('');
  const [characterSubstitutions, setCharacterSubstitutions] = useState<{original: string, newName: string}[]>([
    { original: '', newName: '' }
  ]);

  // Intro Settings State
  const [hookType, setHookType] = useState('Mistério');
  const [protagonistName, setProtagonistName] = useState('');
  const [storyWorld, setStoryWorld] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState('');

  // Output Settings State
  const [outputLanguage, setOutputLanguage] = useState('pt-BR');
  const [narrationTone, setNarrationTone] = useState('Casual');
  
  // Tone & Intensity State
  const [redundancyReducer, setRedundancyReducer] = useState(0);
  const [humorLevel, setHumorLevel] = useState(5);
  const [sarcasmLevel, setSarcasmLevel] = useState(5);
  const [dramaLevel, setDramaLevel] = useState(7);
  const [informalityLevel, setInformalityLevel] = useState(5);
  
  // Youtuber Style State
  const [youtuberStyle, setYoutuberStyle] = useState('');

  const handleAddKeyword = () => {
    if (currentKeyword.trim() && keywords.length < 5) {
      setKeywords([...keywords, currentKeyword.trim()]);
      setCurrentKeyword('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleAddSubstitution = () => {
    setCharacterSubstitutions([...characterSubstitutions, { original: '', newName: '' }]);
  };

  const handleRemoveSubstitution = (index: number) => {
    const newSubs = [...characterSubstitutions];
    newSubs.splice(index, 1);
    setCharacterSubstitutions(newSubs);
  };

  const handleSubstitutionChange = (index: number, field: 'original' | 'newName', value: string) => {
    const newSubs = [...characterSubstitutions];
    newSubs[index][field] = value;
    setCharacterSubstitutions(newSubs);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSrtContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleSplitChapters = () => {
    if (!srtContent) return;
    
    // Parse the SRT into blocks
    const blocks = srtContent.trim().split(/\n\s*\n/);
    const count = Number(chapterCount) || 1;
    
    const newChapters: Chapter[] = [];
    const blocksPerChapter = Math.ceil(blocks.length / count);
    
    for (let i = 0; i < count; i++) {
      const chapterBlocks = blocks.slice(i * blocksPerChapter, (i + 1) * blocksPerChapter);
      if (chapterBlocks.length === 0) continue;
      
      const originalText = chapterBlocks.join('\n\n');
      
      // Calculate word count
      const textWithoutTimestamps = originalText.replace(/\d{1,2}:\d{2}:\d{2},\d{3} --> \d{1,2}:\d{2}:\d{2},\d{3}/g, '')
        .replace(/\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2}/g, '')
        .replace(/^\d+$/gm, '');
      const wordCount = textWithoutTimestamps.split(/\s+/).filter(w => w.trim().length > 0).length;
      
      // Try to extract time range
      let startTime = "00:00:00";
      let endTime = "00:00:00";
      
      const firstBlock = chapterBlocks[0];
      const lastBlock = chapterBlocks[chapterBlocks.length - 1];
      
      const timeRegex = /(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})/;
      const firstMatch = firstBlock.match(timeRegex);
      if (firstMatch) startTime = firstMatch[0];
      
      const lastMatch = lastBlock.match(timeRegex);
      if (lastMatch) endTime = lastMatch[0];
      
      newChapters.push({
        id: i + 1,
        title: `Capítulo ${i + 1}`,
        timeRange: `${startTime} - ${endTime}`,
        originalText,
        wordCount,
        generatedScript: '',
        isGenerating: false
      });
    }
    
    setChapters(newChapters);
  };

  const handleEditSelectionChange = () => {
    if (editTextareaRef.current) {
      const start = editTextareaRef.current.selectionStart;
      const end = editTextareaRef.current.selectionEnd;
      const text = editTextareaRef.current.value.substring(start, end);
      setEditSelection({ start, end, text });
    }
  };

  const handleReplaceOne = () => {
    if (!editingChapterId || !editSearchText) return;
    
    setChapters(prev => prev.map(c => {
      if (c.id === editingChapterId) {
        const regex = new RegExp(editSearchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), editCaseSensitive ? '' : 'i');
        const newScript = c.generatedScript.replace(regex, editReplaceText);
        
        const genWordCount = newScript.split(/\s+/).filter(w => w.trim().length > 0).length;
        return { ...c, generatedScript: newScript, generatedWordCount: genWordCount };
      }
      return c;
    }));
  };

  const handleReplaceAll = () => {
    if (!editingChapterId || !editSearchText) return;
    
    setChapters(prev => prev.map(c => {
      if (c.id === editingChapterId) {
        const flags = editCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(editSearchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        const newScript = c.generatedScript.replace(regex, editReplaceText);
        
        const genWordCount = newScript.split(/\s+/).filter(w => w.trim().length > 0).length;
        return { ...c, generatedScript: newScript, generatedWordCount: genWordCount };
      }
      return c;
    }));
  };

  const handleRephraseSelection = async () => {
    if (!editingChapterId || !editSelection.text || isRephrasing) return;
    
    setIsRephrasing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Reescreva o seguinte trecho de texto para torná-lo mais fluido, natural e envolvente para um roteiro de vídeo do YouTube, mantendo o mesmo significado e idioma original. Retorne APENAS o texto reescrito, sem aspas ou explicações adicionais:
      
      "${editSelection.text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      const rephrasedText = response.text?.trim();
      
      if (rephrasedText) {
        setChapters(prev => prev.map(c => {
          if (c.id === editingChapterId) {
            const before = c.generatedScript.substring(0, editSelection.start);
            const after = c.generatedScript.substring(editSelection.end);
            const newScript = before + rephrasedText + after;
            
            const genWordCount = newScript.split(/\s+/).filter(w => w.trim().length > 0).length;
            return { ...c, generatedScript: newScript, generatedWordCount: genWordCount };
          }
          return c;
        }));
        setEditSelection({ start: 0, end: 0, text: '' });
      }
    } catch (error: any) {
      console.error("Erro ao reformular:", error);
      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.status === 429) {
        alert("Limite de uso da IA excedido (Erro 429). Por favor, aguarde um minuto e tente novamente.");
      } else {
        alert("Erro ao reformular o texto.");
      }
    } finally {
      setIsRephrasing(false);
    }
  };

  const handleGenerateChapterScript = async (chapterId: number) => {
    const chapterIndex = chapters.findIndex(c => c.id === chapterId);
    if (chapterIndex === -1) return;
    
    const chapter = chapters[chapterIndex];
    
    setChapters(prev => {
      const updated = [...prev];
      updated[chapterIndex].isGenerating = true;
      return updated;
    });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const subsText = characterSubstitutions
        .filter(sub => sub.original.trim() !== '' && sub.newName.trim() !== '')
        .map(sub => `- Substituir "${sub.original}" por "${sub.newName}"`)
        .join('\n');

      const prompt = `Você é um roteirista profissional especializado em revisar e melhorar legendas (SRT/Timestamps) de Manhwas, Mangás e Animes.

      INFORMAÇÕES DO PROJETO:
      Nome da Obra (Manhwa/Manga/Anime): ${projectName || 'Não especificado'}
      
      CONFIGURAÇÕES DA INTRODUÇÃO:
      Tipo de Gancho Inicial: ${hookType}
      Nome do Protagonista: ${protagonistName || 'Não especificado'}
      Cenário/Mundo da História: ${storyWorld || 'Não especificado'}
      Temas/Palavras-chave Obrigatórias: ${keywords.length > 0 ? keywords.join(', ') : 'Nenhuma'}
      
      CONFIGURAÇÕES DE SAÍDA E TOM:
      Idioma de Saída: ${outputLanguage}
      Tom da Narração: ${narrationTone}
      Estilo de Roteiro Youtuber: ${youtuberStyle || 'Padrão'}
      
      INTENSIDADE E TOM (0 a 10, ou -15% a +15%):
      Redutor de Redundâncias: ${redundancyReducer}% (Valores negativos = mais conciso, positivos = mais detalhado)
      Humor: ${humorLevel}/10
      Sarcasmo: ${sarcasmLevel}/10
      Drama: ${dramaLevel}/10
      Informalidade: ${informalityLevel}/10

      SUBSTITUIÇÕES DE PERSONAGENS (APLIQUE ESTAS MUDANÇAS NO ROTEIRO FINAL):
      ${subsText || 'Nenhuma substituição especificada.'}

      TAREFA:
      Leia o trecho de legendas abaixo. 
      Sua tarefa é MELHORAR o texto original, mantendo 100% do conteúdo e da história. NÃO RESUMA, NÃO CORTE NADA.
      
      DIRETRIZES:
      1. Mantenha toda a história e os detalhes do texto original. O roteiro final deve ter um tamanho semelhante ao original, ajustado apenas pelo "Redutor de Redundâncias".
      2. IMPORTANTE: O roteiro gerado NÃO DEVE ter uma diferença de tamanho maior que +20% ou menor que -20% em relação ao texto original (exceto se o redutor de redundâncias exigir).
      3. Aplique TODAS as substituições de nomes de personagens solicitadas.
      4. Remova os timestamps e crie um texto fluido e contínuo.
      5. Corrija erros gramaticais, melhore a coesão e a fluidez da leitura para um vídeo do YouTube, baseando-se no "Estilo de Roteiro Youtuber" fornecido.
      6. O texto deve estar no idioma solicitado (${outputLanguage}).
      7. Aplique o tom de narração (${narrationTone}) e os níveis de intensidade (Humor, Sarcasmo, Drama, Informalidade) em todo o texto.
      8. Se este for o primeiro capítulo, certifique-se de incluir um gancho inicial do tipo "${hookType}", mencionar o protagonista "${protagonistName}" e o mundo "${storyWorld}", e incluir as palavras-chave obrigatórias.

      TEXTO ORIGINAL:
      ${chapter.originalText}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      const script = response.text?.trim();
      if (script) {
        const genWordCount = script.split(/\s+/).filter(w => w.trim().length > 0).length;
        setChapters(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(c => c.id === chapterId);
          if (idx !== -1) {
            updated[idx].generatedScript = script;
            updated[idx].generatedWordCount = genWordCount;
            updated[idx].isGenerating = false;
          }
          return updated;
        });
      }
    } catch (error: any) {
      console.error("Erro ao gerar roteiro:", error);
      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.status === 429) {
        alert("Limite de uso da IA excedido (Erro 429). Por favor, aguarde um minuto e tente novamente.");
      } else {
        alert("Erro ao gerar o roteiro com IA.");
      }
      setChapters(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(c => c.id === chapterId);
        if (idx !== -1) {
          updated[idx].isGenerating = false;
        }
        return updated;
      });
    }
  };

  const handleGenerateAll = async () => {
    for (const chapter of chapters) {
      if (!chapter.generatedScript) {
        await handleGenerateChapterScript(chapter.id);
      }
    }
  };

  const handleDownloadTXT = (chapter: Chapter) => {
    if (!chapter.generatedScript) return;
    const element = document.createElement("a");
    const file = new Blob([chapter.generatedScript], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${projectName || 'Roteiro'}_${chapter.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadSRT = (chapter: Chapter) => {
    if (!chapter.generatedScript) return;
    // Basic SRT generation (just splitting by lines for now, as we don't have real timestamps for the generated text)
    const lines = chapter.generatedScript.split('\n').filter(l => l.trim());
    let srtContent = '';
    let time = 0;
    
    lines.forEach((line, index) => {
      const start = new Date(time * 1000).toISOString().substr(11, 12).replace('.', ',');
      time += 5; // Assume 5 seconds per line for a basic mock
      const end = new Date(time * 1000).toISOString().substr(11, 12).replace('.', ',');
      
      srtContent += `${index + 1}\n${start} --> ${end}\n${line}\n\n`;
    });

    const element = document.createElement("a");
    const file = new Blob([srtContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${projectName || 'Roteiro'}_${chapter.title}.srt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-8 bg-[#2a204a]">
      {/* Edit Modal */}
      {editingChapterId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1536] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 size={24} className="text-amber-400" />
                Editar {chapters.find(c => c.id === editingChapterId)?.title}
              </h2>
              <button onClick={() => setEditingChapterId(null)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              <p className="text-sm text-gray-400">
                Edite o texto do capítulo, use buscar e substituir, ou reformule trechos com IA.
              </p>
              
              <div className="flex-1 min-h-[300px] border border-purple-500/30 rounded-xl overflow-hidden focus-within:border-purple-500 transition-colors flex flex-col">
                <textarea
                  ref={editTextareaRef}
                  value={chapters.find(c => c.id === editingChapterId)?.generatedScript || ''}
                  onChange={(e) => {
                    const newScript = e.target.value;
                    const genWordCount = newScript.split(/\s+/).filter(w => w.trim().length > 0).length;
                    setChapters(prev => prev.map(c => c.id === editingChapterId ? { ...c, generatedScript: newScript, generatedWordCount: genWordCount } : c));
                  }}
                  onSelect={handleEditSelectionChange}
                  onMouseUp={handleEditSelectionChange}
                  onKeyUp={handleEditSelectionChange}
                  className="flex-1 w-full bg-black/30 p-4 text-gray-200 text-sm leading-relaxed focus:outline-none resize-none custom-scrollbar font-mono"
                  spellCheck={false}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Find and Replace */}
                <div className="bg-black/20 p-5 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Search size={16} className="text-blue-400" /> Substituir Palavras
                  </h3>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={editSearchText}
                      onChange={(e) => setEditSearchText(e.target.value)}
                      placeholder="Buscar palavra..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                    <input 
                      type="text" 
                      value={editReplaceText}
                      onChange={(e) => setEditReplaceText(e.target.value)}
                      placeholder="Substituir por..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editCaseSensitive}
                        onChange={(e) => setEditCaseSensitive(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50"
                      />
                      Diferenciar maiúsculas/minúsculas
                    </label>
                    <div className="flex gap-3 pt-2">
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleReplaceOne();
                        }}
                        disabled={!editSearchText}
                        className="flex-1 py-2 bg-black/40 hover:bg-black/60 border border-white/10 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        Substituir 1
                      </button>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleReplaceAll();
                        }}
                        disabled={!editSearchText}
                        className="flex-1 py-2 bg-black/40 hover:bg-black/60 border border-white/10 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        Substituir Todos
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* AI Rephrase */}
                <div className="bg-black/20 p-5 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-400" /> Reformular com IA
                  </h3>
                  <div className="space-y-4">
                    {editSelection.text ? (
                      <p className="text-xs text-gray-400 mb-2">
                        Texto selecionado: "{editSelection.text.substring(0, 40)}{editSelection.text.length > 40 ? '...' : ''}"
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">
                        Selecione um trecho de texto no editor acima
                      </p>
                    )}
                    <button 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleRephraseSelection();
                      }}
                      disabled={!editSelection.text || isRephrasing}
                      className="w-full py-3 bg-gradient-to-r from-purple-600/80 to-amber-600/80 hover:from-purple-500 hover:to-amber-500 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isRephrasing ? (
                        <><Loader2 size={16} className="animate-spin" /> Reformulando...</>
                      ) : (
                        <><Sparkles size={16} /> Reformular Seleção</>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Selecione um texto e clique em "Reformular Seleção"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-400 mb-4 cursor-pointer hover:text-white w-fit">
          <ArrowLeft size={16} />
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Zap size={28} className="text-white" />
          Criador de Roteiro
        </h1>
        <p className="text-sm text-gray-400">
          Transforme legendas em roteiros incríveis
        </p>
      </div>

      <div className="max-w-5xl">
        {/* Tabs */}
        <div className="flex bg-[#1e1536] rounded-xl border border-white/5 overflow-hidden mb-6">
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'upload' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={16} /> Enviar Arquivo
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'paste' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'}`}
            onClick={() => setActiveTab('paste')}
          >
            <FileText size={16} /> Colar Texto
          </button>
        </div>

        {/* Content Area */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText size={20} /> Colar Texto SRT
          </h2>
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4 flex gap-3">
            <Info size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80">
              <strong className="text-amber-400">Novo:</strong> Agora suporta partes intermediárias! Pode começar com qualquer timestamp como 1:05:30 ou 72:15.
            </p>
          </div>

          {activeTab === 'paste' ? (
            <textarea
              value={srtContent}
              onChange={(e) => setSrtContent(e.target.value)}
              placeholder="Cole seu conteúdo SRT aqui..."
              className="w-full h-64 bg-[#1e1536] border border-white/10 rounded-lg p-4 text-gray-300 text-sm font-mono focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar"
            />
          ) : (
            <div 
              className="w-full h-64 bg-[#1e1536] border-2 border-dashed border-white/10 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".srt,.txt"
              />
              <Upload size={48} className="text-gray-500 mb-4" />
              <p className="text-white font-medium text-lg mb-1">Clique para fazer upload</p>
              <p className="text-gray-500 text-sm">ou arraste o arquivo .srt ou .txt aqui</p>
            </div>
          )}
        </div>

        {/* Format Examples */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Diamond size={16} className="text-blue-400" /> Formato Gemini Studio
            </h3>
            <p className="text-xs text-gray-400 mb-3">Timestamps e texto na mesma linha (com ou sem ' - ').</p>
            <div className="bg-[#1e1536] border border-white/10 rounded-lg p-4 text-xs font-mono text-gray-300 h-32">
              00:04 O protagonista chegou<br/>
              1:01:52 - Ele encontra a porta
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Youtube size={16} className="text-red-400" /> Formato YouTube
            </h3>
            <p className="text-xs text-gray-400 mb-3">Timestamps simples (ex: 65:15 ou 1:05:15)</p>
            <div className="bg-[#1e1536] border border-white/10 rounded-lg p-4 text-xs font-mono text-gray-300 h-32">
              65:15<br/>
              Chegou ao castelo<br/>
              <br/>
              1:05:30<br/>
              Encontrou a porta
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <FileCode2 size={16} className="text-gray-400" /> Formato SRT/Legendas
            </h3>
            <p className="text-xs text-gray-400 mb-3">Timestamps com --&gt; (numeração opcional)</p>
            <div className="bg-[#1e1536] border border-white/10 rounded-lg p-4 text-xs font-mono text-gray-300 h-32 overflow-y-auto custom-scrollbar">
              1<br/>
              01:05:15,000 --&gt; 01:05:25,000<br/>
              Com numeração (padrão)<br/>
              <br/>
              00:00:00,105 --&gt; 00:02,155<br/>
              Nossa história começa sob um céu lindão.<br/>
              <br/>
              00:03,175 --&gt; 00:07,025<br/>
              Sem numeração (formato Gemini)
            </div>
          </div>
        </div>

        {/* Project Config */}
        <div className="bg-[#1e1536] p-6 rounded-xl border border-white/5 mb-8">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Settings size={20} className="text-emerald-400" />
            Configurações do Projeto
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Nome do Projeto (Manhwa/Manga)</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: Solo Leveling"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <BookOpen size={16} className="text-gray-400" />
                Número de Capítulos
              </label>
              <input 
                type="number" 
                value={chapterCount}
                onChange={(e) => setChapterCount(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ex: 5"
                min="1"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-red-400 mt-2">Defina em quantos capítulos a IA deve dividir a história.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Users size={16} className="text-gray-400" />
                Substituição de Personagens
              </label>
              <p className="text-xs text-gray-400 mb-4">Substitua automaticamente nomes no roteiro gerado.</p>
              
              <div className="space-y-3">
                {characterSubstitutions.map((sub, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={sub.original}
                      onChange={(e) => handleSubstitutionChange(index, 'original', e.target.value)}
                      placeholder="Nome original"
                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                    <span className="text-gray-500">→</span>
                    <input 
                      type="text" 
                      value={sub.newName}
                      onChange={(e) => handleSubstitutionChange(index, 'newName', e.target.value)}
                      placeholder="Novo nome"
                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                    {characterSubstitutions.length > 1 && (
                      <button 
                        onClick={() => handleRemoveSubstitution(index)}
                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleAddSubstitution}
                className="mt-3 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus size={16} /> Adicionar substituição
              </button>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1e1536] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
              <div className="sticky top-0 bg-[#1e1536] border-b border-white/10 p-6 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings size={24} className="text-purple-400" />
                  Configurações da IA
                </h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Intro Settings */}
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Zap size={20} className="text-purple-400" />
                    Configurações da Introdução
                  </h2>
                  <p className="text-sm text-gray-400 mb-6">Personalize como a IA vai criar a introdução de 1 minuto do seu roteiro</p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Zap size={16} className="text-gray-400" /> Tipo de Gancho Inicial
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'Mistério', icon: '🔍', desc: 'Intrigante e suspense' },
                          { id: 'Ação', icon: '💥', desc: 'Impacto imediato' },
                          { id: 'Emocional', icon: '❤️', desc: 'Conexão profunda' },
                          { id: 'Provocativo', icon: '🔥', desc: 'Ousado e direto' }
                        ].map(hook => (
                          <button
                            key={hook.id}
                            onClick={() => setHookType(hook.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              hookType === hook.id 
                                ? 'bg-purple-500/10 border-purple-500/50' 
                                : 'bg-black/20 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="font-bold text-white flex items-center gap-2 mb-1">
                              <span>{hook.icon}</span> {hook.id}
                            </div>
                            <div className="text-xs text-gray-400">{hook.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Nome do Protagonista (opcional)</label>
                      <input 
                        type="text" 
                        value={protagonistName}
                        onChange={(e) => setProtagonistName(e.target.value)}
                        placeholder="Ex: Sung Jin-Woo"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                      />
                      <p className="text-xs text-gray-400 mt-2">A IA vai mencionar o protagonista logo no início para criar conexão</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Cenário/Mundo da História (opcional)</label>
                      <input 
                        type="text" 
                        value={storyWorld}
                        onChange={(e) => setStoryWorld(e.target.value)}
                        placeholder="Ex: Um mundo onde existem caçadores e portais mágicos"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                      />
                      <p className="text-xs text-gray-400 mt-2">Ajuda a situar o espectador no universo da história</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <BookOpen size={16} className="text-gray-400" /> Temas/Palavras-chave Obrigatórias (máx. 5)
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input 
                          type="text" 
                          value={currentKeyword}
                          onChange={(e) => setCurrentKeyword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                          placeholder="Ex: poderes mágicos, vingança, escolhido"
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                          disabled={keywords.length >= 5}
                        />
                        <button 
                          onClick={handleAddKeyword}
                          disabled={!currentKeyword.trim() || keywords.length >= 5}
                          className="px-4 py-2 bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {keywords.map((kw, idx) => (
                            <span key={idx} className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                              {kw}
                              <button onClick={() => handleRemoveKeyword(idx)} className="hover:text-white"><Trash2 size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Info size={12} /> A IA vai garantir que todos esses temas sejam mencionados na introdução
                      </p>
                    </div>
                  </div>
                </div>

                {/* Output Language & Tone */}
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-blue-400" /> Idioma de Saída
                      </h2>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'pt-BR', label: 'BR Português Brasileiro', desc: 'Informal e envolvente' },
                          { id: 'en-US', label: 'US English', desc: 'American native' },
                          { id: 'es-ES', label: 'ES Español', desc: 'Nativo mexicano' },
                          { id: 'fr-FR', label: 'FR Français', desc: 'Nativo francês' }
                        ].map(lang => (
                          <button
                            key={lang.id}
                            onClick={() => setOutputLanguage(lang.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              outputLanguage === lang.id 
                                ? 'bg-purple-500/10 border-purple-500/50' 
                                : 'bg-black/20 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="font-bold text-white mb-1">{lang.label}</div>
                            <div className="text-xs text-gray-400">{lang.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-amber-400" /> Tom da Narração
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { id: 'Casual', desc: 'Envolvente e natural' },
                          { id: 'Sarcástico', desc: 'Irônico e divertido' },
                          { id: 'Dramático', desc: 'Intenso e emocional' },
                          { id: 'Engraçado', desc: 'Descontraído e bem-humorado' },
                          { id: 'Ação', desc: 'Cheio de energia' },
                          { id: 'Suspense', desc: 'Misterioso e intrigante' }
                        ].map(tone => (
                          <button
                            key={tone.id}
                            onClick={() => setNarrationTone(tone.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              narrationTone === tone.id 
                                ? 'bg-amber-500/10 border-amber-500/50' 
                                : 'bg-black/20 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="font-bold text-white mb-1">{tone.id}</div>
                            <div className="text-xs text-gray-400">{tone.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intensity and Tone Sliders */}
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Zap size={20} className="text-pink-400" /> Intensidade e Tom
                    </h2>
                  </div>
                  
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-medium text-white flex items-center gap-1">
                          Redutor de Redundâncias: {redundancyReducer}% <Info size={14} className="text-gray-500" />
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="-15" max="15" 
                        value={redundancyReducer} 
                        onChange={(e) => setRedundancyReducer(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>-15% (Muito Conciso)</span>
                        <span>0% (Neutro)</span>
                        <span>+15% (Mais Detalhado)</span>
                      </div>
                      <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200/80">
                        <strong>Como funciona:</strong> A IA tentará se aproximar dessa meta de redução/expansão. Valores negativos resultam em roteiros mais concisos e dinâmicos, eliminando redundâncias e repetições desnecessárias, ideais para vídeos de resumo.
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-medium text-white flex items-center gap-1">
                          Humor: {humorLevel}/10 <Info size={14} className="text-gray-500" />
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="10" 
                        value={humorLevel} 
                        onChange={(e) => setHumorLevel(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="text-xs text-gray-400 mt-1">Equilíbrio entre seriedade e momentos engraçados</div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-medium text-white flex items-center gap-1">
                          Sarcasmo: {sarcasmLevel}/10 <Info size={14} className="text-gray-500" />
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="10" 
                        value={sarcasmLevel} 
                        onChange={(e) => setSarcasmLevel(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="text-xs text-gray-400 mt-1">Tom irônico moderado, sarcasmo equilibrado</div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-medium text-white flex items-center gap-1">
                          Drama: {dramaLevel}/10 <Info size={14} className="text-gray-500" />
                        </label>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="10" 
                        value={dramaLevel} 
                        onChange={(e) => setDramaLevel(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="text-xs text-gray-400 mt-1">Dramatização intensa e emocional</div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <label className="font-medium text-white flex items-center gap-1">
                          <Info size={14} className="text-gray-500" /> Informalidade
                        </label>
                        {informalityLevel >= 8 && (
                          <span className="text-xs font-bold text-pink-400 bg-pink-500/10 px-2 py-1 rounded">
                            {informalityLevel}/10 - 🔥 SUPER INFORMAL - Gírias pesadas, mano!
                          </span>
                        )}
                      </div>
                      <input 
                        type="range" 
                        min="0" max="10" 
                        value={informalityLevel} 
                        onChange={(e) => setInformalityLevel(Number(e.target.value))}
                        className="w-full accent-pink-500"
                      />
                      {informalityLevel >= 8 && (
                        <div className="text-xs text-pink-300 mt-2">
                          🔥 LINGUAGEM ULTRA INFORMAL JOVEM - 'Mano', 'brow', 'truta', 'bagulho', 'parada loca', gírias pesadas!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Youtuber Style */}
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Youtube size={20} className="text-red-400" />
                    Estilo de Roteiro Youtuber
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Canais de Referência (opcional)</label>
                    <input 
                      type="text" 
                      value={youtuberStyle}
                      onChange={(e) => setYoutuberStyle(e.target.value)}
                      placeholder="Ex: iJaxManhwa, ManhwaDoKawa, MomoManhwa"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
                    />
                    <p className="text-xs text-gray-400 mt-2">Coloque o nome do canal do YouTube que você quer que a IA use como base para o estilo do roteiro. Separe por vírgulas se for mais de um.</p>
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-[#1e1536] border-t border-white/10 p-6 flex justify-end z-10">
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-purple-500/20"
                >
                  Salvar e Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Indicator & Action Button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-gray-400">
            {srtContent ? (
              srtContent.match(/\d+:\d+/) ? (
                <>
                  <Check size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Conteúdo Detectado</p>
                    <p className="text-xs">Pronto para dividir em capítulos</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={20} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-amber-400">Formato Suspeito</p>
                    <p className="text-xs text-amber-200/80">Não encontramos timestamps (ex: 00:00). A IA pode ter dificuldade.</p>
                  </div>
                </>
              )
            ) : (
              <>
                <AlertCircle size={20} />
                <div>
                  <p className="text-sm font-bold text-white">Aguardando Conteúdo</p>
                  <p className="text-xs">Cole ou faça upload de um arquivo</p>
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={handleSplitChapters}
            disabled={!srtContent}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-purple-500/20"
          >
            <BookOpen size={18} />
            Dividir em Capítulos
          </button>
        </div>

        {/* Chapters Area */}
        {chapters.length > 0 && (
          <div className="space-y-8 mb-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText size={24} className="text-purple-400" /> Capítulos Gerados
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-white/10"
                >
                  <Settings size={16} /> Configurações da IA
                </button>
                <button 
                  onClick={handleGenerateAll}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Zap size={16} /> Gerar Todos os Roteiros
                </button>
              </div>
            </div>

            {chapters.map(chapter => (
              <div key={chapter.id} className="bg-[#1e1536] rounded-xl border border-white/5 overflow-hidden">
                <div className="bg-black/20 px-6 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen size={18} className="text-purple-400" />
                    {chapter.title} <span className="text-sm font-normal text-gray-400">({chapter.timeRange})</span>
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (chapter.generatedScript) {
                          setEditingChapterId(chapter.id);
                        }
                      }}
                      disabled={!chapter.generatedScript}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors">
                      <Mic size={14} /> Narrar
                    </button>
                    <button 
                      onClick={() => {
                        if (chapter.generatedScript) {
                          navigator.clipboard.writeText(chapter.generatedScript);
                          alert("Roteiro copiado!");
                        }
                      }}
                      disabled={!chapter.generatedScript}
                      className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-white border border-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Copy size={14} /> Copiar
                    </button>
                    <button 
                      onClick={() => handleDownloadTXT(chapter)}
                      disabled={!chapter.generatedScript}
                      className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-emerald-400 border border-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Download size={14} /> TXT
                    </button>
                    <button 
                      onClick={() => handleDownloadSRT(chapter)}
                      disabled={!chapter.generatedScript}
                      className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-blue-400 border border-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Download size={14} /> SRT
                    </button>
                    <button 
                      onClick={() => handleGenerateChapterScript(chapter.id)}
                      disabled={chapter.isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={chapter.isGenerating ? "animate-spin" : ""} /> Refazer
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                  {/* Original Side */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                        <FileText size={16} /> Original
                      </h4>
                      <span className="text-xs font-medium bg-white/5 text-gray-400 px-2 py-1 rounded-md">
                        {chapter.wordCount} palavras
                      </span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-4 h-96 overflow-y-auto custom-scrollbar">
                      <p className="text-sm text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {chapter.originalText}
                      </p>
                    </div>
                  </div>

                  {/* Generated Side */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Zap size={16} className="text-purple-400" /> Roteiro
                      </h4>
                      <div className="flex items-center gap-3">
                        {chapter.generatedWordCount !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium bg-purple-500/10 text-purple-400 px-2 py-1 rounded-md">
                              {chapter.generatedWordCount} palavras
                            </span>
                            <span className={`text-xs font-bold ${chapter.generatedWordCount > chapter.wordCount ? 'text-emerald-400' : 'text-red-400'}`}>
                              {chapter.generatedWordCount > chapter.wordCount ? '+' : ''}{Math.round(((chapter.generatedWordCount - chapter.wordCount) / chapter.wordCount) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-black/20 rounded-lg p-4 h-96 overflow-y-auto custom-scrollbar relative group">
                      {chapter.generatedScript ? (
                        <textarea
                          value={chapter.generatedScript}
                          onChange={(e) => {
                            const newScript = e.target.value;
                            setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, generatedScript: newScript } : c));
                          }}
                          className="w-full h-full bg-transparent border-none text-gray-200 text-sm leading-relaxed focus:outline-none resize-none custom-scrollbar"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button 
                            onClick={() => handleGenerateChapterScript(chapter.id)}
                            disabled={chapter.isGenerating}
                            className="text-sm font-medium text-gray-400 hover:text-purple-400 transition-colors flex items-center gap-2"
                          >
                            {chapter.isGenerating ? (
                              <>
                                <Loader2 size={16} className="animate-spin" /> Gerando...
                              </>
                            ) : (
                              <>
                                Clique em "Gerar Roteiro" ou aqui
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
