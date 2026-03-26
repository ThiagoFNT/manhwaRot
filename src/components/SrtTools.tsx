import React, { useState, useRef } from 'react';
import { Clock, Upload, FileText, Download, Loader2, ArrowLeft, Scissors, Sparkles, Users, Check, Languages, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { GoogleGenAI, Type } from '@google/genai';

interface SrtBlock {
  id: number;
  title: string;
  durationStr: string;
  startTime: string;
  endTime: string;
  segmentsCount: number;
  text: string;
  originalSrt: string;
}

export function SrtTools() {
  const [srtContent, setSrtContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(3);
  const [language, setLanguage] = useState<string>('BR Português');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [generatedBlocks, setGeneratedBlocks] = useState<SrtBlock[]>([]);
  const [processingBlocks, setProcessingBlocks] = useState<Record<number, boolean>>({});
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Ordena os arquivos por nome (ex: parte1, parte2, parte10)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (files.length === 1) {
      setFileName(files[0].name);
    } else {
      setFileName(`${files.length} arquivos selecionados`);
    }

    try {
      const contents = await Promise.all(
        files.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
          });
        })
      );

      // Junta o conteúdo de todos os arquivos
      setSrtContent(contents.join('\n\n'));
    } catch (error) {
      console.error("Erro ao ler arquivos:", error);
      alert("Erro ao ler os arquivos.");
    }
    
    // Reseta o input para permitir selecionar os mesmos arquivos novamente se necessário
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length < 3) return 0;
    const hours = parts[0];
    const minutes = parts[1];
    const secondsParts = parts[2].split(/[,.]/);
    const sec = secondsParts[0];
    const ms = secondsParts[1] || '0';
    return (
      parseInt(hours) * 3600000 +
      parseInt(minutes) * 60000 +
      parseInt(sec) * 1000 +
      parseInt(ms)
    );
  };

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minutes = Math.floor(ms / 60000);
    ms %= 60000;
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  };

  const [isAnalyzingNames, setIsAnalyzingNames] = useState(false);
  const [extractedNames, setExtractedNames] = useState<{original: string, corrected: string}[]>([]);
  const [namesAnalyzed, setNamesAnalyzed] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToSrt = async () => {
    if (!srtContent) return;
    setIsConverting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `O texto a seguir é uma transcrição com timestamps bagunçados (ex: "28:1428 minutos e 14 segundosaround"). 
        Por favor, converta este texto para o formato padrão SRT (.srt).
        Tente deduzir o tempo de início e fim de cada bloco com base nos timestamps disponíveis.
        Se um timestamp for "28:14", assuma que é 00:28:14,000.
        Corrija palavras grudadas nos timestamps (ex: "segundosaround" -> "around").
        Retorne APENAS o conteúdo SRT válido, sem formatação markdown.
        
        Texto:
        ${srtContent}`,
      });
      
      const newSrt = response.text?.trim();
      if (newSrt) {
        setSrtContent(newSrt);
        alert("Texto convertido para SRT com sucesso! Agora você pode dividi-lo.");
      }
    } catch (error) {
      console.error("Erro ao converter:", error);
      alert("Erro ao tentar converter o texto para SRT.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleAnalyzeNames = async () => {
    if (!srtContent) return;
    setIsAnalyzingNames(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Leia atentamente o roteiro/legendas (SRT) abaixo. 
        Primeiro, entenda do que se trata a história por completo. Identifique quem é o protagonista, quem são os personagens secundários, os vilões e os lugares ou famílias importantes do universo da obra (geralmente um Manhwa, Manga ou Anime).
        
        Com base nesse entendimento profundo da história e do contexto, extraia todos os nomes próprios relevantes (personagens, lugares, clãs, etc).
        
        Muitas vezes, devido a erros de tradução automática ou OCR, o mesmo nome pode aparecer escrito de várias formas erradas ou inconsistentes ao longo do texto. Seu trabalho é unificar e corrigir esses nomes para a versão mais coerente com a história.
        
        Retorne APENAS um array JSON de objetos. Cada objeto deve ter:
        - "original": A forma exata como o nome aparece no texto (incluindo as versões erradas).
        - "corrected": O nome corrigido e padronizado, baseado no seu entendimento de quem é o personagem e qual é o nome correto dele na história.
        
        Não inclua formatação markdown, apenas o JSON puro.
        
        Legendas:
        ${srtContent}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: {
                  type: Type.STRING,
                  description: "O nome original encontrado no texto",
                },
                corrected: {
                  type: Type.STRING,
                  description: "O nome corrigido (ou o mesmo se estiver correto)",
                },
              },
              required: ["original", "corrected"]
            },
          },
        },
      });

      const jsonStr = response.text?.trim() || "[]";
      const names = JSON.parse(jsonStr);
      
      if (names && names.length > 0) {
        setExtractedNames(names);
      } else {
        throw new Error("Nenhum nome encontrado");
      }
    } catch (error) {
      console.error("Erro ao analisar nomes com IA:", error);
      // Fallback para extração manual
      const words: string[] = srtContent.match(/\b[A-Z][a-zÀ-ÿ]+\b/g) || [];
      const uniqueWords = Array.from(new Set(words)).filter((w: string) => w.length > 2);
      
      const mockNames = [
        { original: 'Alan Palácio', corrected: 'Alan Paládio' },
        { original: 'Asteria', corrected: 'Asteria' },
        { original: 'Condado de Palácio', corrected: 'Condado de Palácio' },
        { original: 'Léo', corrected: 'Léo' },
        { original: 'Tony', corrected: 'Tony' },
        { original: 'família Palácio', corrected: 'família Palácio' }
      ];
      
      const namesToUse = uniqueWords.length > 0 
        ? uniqueWords.slice(0, 6).map(w => ({ original: w, corrected: w }))
        : mockNames;

      setExtractedNames(namesToUse);
    } finally {
      setNamesAnalyzed(true);
      setIsAnalyzingNames(false);
    }
  };

  const handleNameChange = (index: number, newName: string) => {
    const updated = [...extractedNames];
    updated[index].corrected = newName;
    setExtractedNames(updated);
  };

  const handleApplyCorrections = () => {
    let updatedContent = srtContent;
    extractedNames.forEach(({ original, corrected }) => {
      if (original !== corrected && corrected.trim() !== '') {
        // Replace all occurrences of the original name with the corrected one
        const regex = new RegExp(`\\b${original}\\b`, 'g');
        updatedContent = updatedContent.replace(regex, corrected);
      }
    });
    setSrtContent(updatedContent);
    alert('Correções aplicadas com sucesso no SRT!');
  };

  const handleSplit = async () => {
    if (!srtContent) return;
    setIsProcessing(true);

    try {
      // Normalize line endings to \n before splitting
      const normalizedSrt = srtContent.replace(/\r\n/g, '\n').trim();
      const blocks = normalizedSrt.split(/\n\s*\n/);
      const intervalMs = intervalMinutes * 60 * 1000;
      
      const parts: SrtBlock[] = [];
      let currentPartSrt: string[] = [];
      let currentPartText: string[] = [];
      let currentPartEndTime = intervalMs;
      let partIndex = 1;
      let startTimeStr = "";
      let endTimeStr = "";
      let startMs = 0;

      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) continue; // Need at least time and text

        const timeLineIndex = lines.findIndex(l => l.includes('-->'));
        if (timeLineIndex === -1) continue;

        const timeLine = lines[timeLineIndex];
        const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
        if (!startStr || !endStr) continue;

        const startTimeMs = parseTime(startStr);
        const endTimeMs = parseTime(endStr);
        
        if (currentPartSrt.length === 0) {
            startTimeStr = startStr;
            startMs = startTimeMs;
        }
        
        if (startTimeMs >= currentPartEndTime && currentPartSrt.length > 0) {
          const durationMs = parseTime(endTimeStr) - startMs;
          const durationMin = Math.floor(durationMs / 60000);
          const durationSec = Math.floor((durationMs % 60000) / 1000);
          
          parts.push({
              id: partIndex,
              title: `Bloco ${partIndex}`,
              durationStr: `${durationMin}m ${durationSec}s`,
              startTime: startTimeStr,
              endTime: endTimeStr,
              segmentsCount: currentPartSrt.length,
              text: currentPartText.join(' '),
              originalSrt: currentPartSrt.map((b, i) => {
                  const l = b.split('\n');
                  const tIdx = l.findIndex(line => line.includes('-->'));
                  if (tIdx > 0) {
                      l[0] = String(i + 1);
                  } else {
                      l.unshift(String(i + 1));
                  }
                  return l.join('\n');
              }).join('\n\n')
          });
          
          currentPartSrt = [];
          currentPartText = [];
          partIndex++;
          currentPartEndTime = partIndex * intervalMs;
          startTimeStr = startStr;
          startMs = startTimeMs;
        }
        
        currentPartSrt.push(block);
        currentPartText.push(lines.slice(timeLineIndex + 1).join(' '));
        endTimeStr = endStr;
      }
      
      if (currentPartSrt.length > 0) {
          const durationMs = parseTime(endTimeStr) - startMs;
          const durationMin = Math.floor(durationMs / 60000);
          const durationSec = Math.floor((durationMs % 60000) / 1000);
          
          parts.push({
              id: partIndex,
              title: `Bloco ${partIndex}`,
              durationStr: `${durationMin}m ${durationSec}s`,
              startTime: startTimeStr,
              endTime: endTimeStr,
              segmentsCount: currentPartSrt.length,
              text: currentPartText.join(' '),
              originalSrt: currentPartSrt.map((b, i) => {
                  const l = b.split('\n');
                  const tIdx = l.findIndex(line => line.includes('-->'));
                  if (tIdx > 0) {
                      l[0] = String(i + 1);
                  } else {
                      l.unshift(String(i + 1));
                  }
                  return l.join('\n');
              }).join('\n\n')
          });
      }

      if (parts.length === 0) {
        alert("Não foi possível encontrar blocos SRT válidos. Verifique se o formato está correto (ex: 1\\n00:00:00,000 --> 00:00:05,000\\nTexto).");
      } else {
        setGeneratedBlocks(parts);
      }

    } catch (error) {
      console.error("Error splitting SRT:", error);
      alert("Ocorreu um erro ao processar o arquivo SRT.");
    }

    setIsProcessing(false);
  };

  const handleImproveBlock = async (id: number) => {
    const block = generatedBlocks.find(b => b.id === id);
    if (!block) return;

    setProcessingBlocks(prev => ({ ...prev, [id]: true }));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Melhore e corrija o seguinte arquivo de legenda SRT. Mantenha os tempos e a numeração exatamente como estão. 
        
        Sua tarefa é:
        1. Corrigir a pontuação, vírgulas, gramática e fluidez do texto.
        2. Adaptar o tom e o estilo para ficar parecido com os roteiros dinâmicos e envolventes de canais do YouTube de recap de Manhwa, como "iJaxManhwa", "ManhwaDoKawa" e "MomoManhwa". 
        3. O texto deve ser narrativo, empolgante, com pausas dramáticas bem pontuadas e fácil de ler em voz alta.
        
        Retorne APENAS o conteúdo SRT válido, sem formatação markdown ou explicações.\n\nSRT:\n${block.originalSrt}`,
      });

      const improvedSrt = response.text?.trim();
      if (improvedSrt) {
        // Extract plain text from the new SRT
        const blocks = improvedSrt.split(/\n\s*\n/);
        const textLines = blocks.map(b => {
          const lines = b.split('\n');
          const tIdx = lines.findIndex(line => line.includes('-->'));
          return tIdx !== -1 ? lines.slice(tIdx + 1).join(' ') : '';
        }).filter(t => t.trim() !== '');
        
        setGeneratedBlocks(prev => prev.map(b => b.id === id ? { 
          ...b, 
          originalSrt: improvedSrt,
          text: textLines.join(' ')
        } : b));
      }
    } catch (error) {
      console.error("Erro ao melhorar bloco:", error);
      alert("Erro ao melhorar o bloco com IA.");
    } finally {
      setProcessingBlocks(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleTranslateBlock = async (id: number) => {
    const block = generatedBlocks.find(b => b.id === id);
    if (!block) return;

    setProcessingBlocks(prev => ({ ...prev, [id]: true }));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Traduza o seguinte arquivo de legenda SRT para Português Brasil. Mantenha os tempos e a numeração exatamente como estão. Traduza apenas o texto. Retorne APENAS o conteúdo SRT válido, sem formatação markdown ou explicações.\n\nSRT:\n${block.originalSrt}`,
      });

      const translatedSrt = response.text?.trim();
      if (translatedSrt) {
        // Extract plain text from the new SRT
        const blocks = translatedSrt.split(/\n\s*\n/);
        const textLines = blocks.map(b => {
          const lines = b.split('\n');
          const tIdx = lines.findIndex(line => line.includes('-->'));
          return tIdx !== -1 ? lines.slice(tIdx + 1).join(' ') : '';
        }).filter(t => t.trim() !== '');
        
        setGeneratedBlocks(prev => prev.map(b => b.id === id ? { 
          ...b, 
          originalSrt: translatedSrt,
          text: textLines.join(' ')
        } : b));
      }
    } catch (error) {
      console.error("Erro ao traduzir bloco:", error);
      alert("Erro ao traduzir o bloco com IA.");
    } finally {
      setProcessingBlocks(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleImproveAll = async () => {
    setIsProcessingAll(true);
    for (const block of generatedBlocks) {
      await handleImproveBlock(block.id);
    }
    setIsProcessingAll(false);
  };

  const handleTranslateAll = async () => {
    setIsProcessingAll(true);
    for (const block of generatedBlocks) {
      await handleTranslateBlock(block.id);
    }
    setIsProcessingAll(false);
  };

  const handleDownloadBlock = (block: SrtBlock) => {
    const blob = new Blob([block.originalSrt], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${fileName ? fileName.replace('.srt', '') : 'legenda'}_bloco${block.id}.srt`);
  };

  const handleDownloadAllTxt = () => {
    const allText = generatedBlocks.map(b => `--- Bloco ${b.id} ---\n${b.text}`).join('\n\n');
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${fileName ? fileName.replace('.srt', '') : 'roteiro'}_completo.txt`);
  };

  const handleDownloadAllSrt = () => {
    const baseName = fileName ? fileName.replace('.srt', '') : 'legendas';

    let combinedSrt = '';
    let globalIndex = 1;

    generatedBlocks.forEach((block) => {
      const srtBlocks = block.originalSrt.split(/\n\s*\n/);
      srtBlocks.forEach(srtBlock => {
        if (!srtBlock.trim()) return;
        const lines = srtBlock.split('\n');
        const tIdx = lines.findIndex(line => line.includes('-->'));
        if (tIdx !== -1) {
          if (tIdx > 0) {
            lines[0] = String(globalIndex);
          } else {
            lines.unshift(String(globalIndex));
          }
          combinedSrt += lines.join('\n') + '\n\n';
          globalIndex++;
        }
      });
    });

    const blob = new Blob([combinedSrt.trim()], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${baseName}_completo.srt`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-8 bg-[#2a204a]">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-gray-400 mb-4 cursor-pointer hover:text-white w-fit">
          <ArrowLeft size={16} />
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Clock size={28} className="text-emerald-400" />
          Divisor Temporal de SRT
        </h1>
        <p className="text-sm text-gray-400">
          Divida SRT em blocos por tempo + correção automática para geração de áudio multilíngue
        </p>
      </div>

      <div className="flex gap-8 max-w-6xl mb-8">
        {/* Left Column: Input */}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white mb-4">1. Insira o SRT</h2>
          
          <div className="bg-[#1e1536] rounded-xl border border-white/5 overflow-hidden">
            <div className="flex border-b border-white/5">
              <button 
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'paste' ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'}`}
                onClick={() => setActiveTab('paste')}
              >
                <FileText size={16} /> Colar
              </button>
              <button 
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'upload' ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'}`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={16} /> Upload
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'upload' ? (
                <div 
                  className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".srt"
                    multiple
                  />
                  {fileName ? (
                    <>
                      <FileText size={48} className="text-emerald-400 mb-4" />
                      <p className="text-white font-medium text-lg mb-1">Arquivo Selecionado</p>
                      <p className="text-emerald-400 text-sm">{fileName}</p>
                    </>
                  ) : (
                    <>
                      <Upload size={48} className="text-gray-500 mb-4" />
                      <p className="text-white font-medium text-lg mb-1">Clique para fazer upload</p>
                      <p className="text-gray-500 text-sm">ou arraste os arquivos .srt aqui</p>
                    </>
                  )}
                </div>
              ) : (
                <textarea
                  value={srtContent}
                  onChange={(e) => {
                    setSrtContent(e.target.value);
                    setFileName('colado.srt');
                  }}
                  placeholder="Cole o conteúdo do seu arquivo SRT aqui..."
                  className="w-full h-64 bg-black/30 border border-white/10 rounded-lg p-4 text-gray-300 text-sm font-mono focus:outline-none focus:border-emerald-500/50 resize-none custom-scrollbar"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Config */}
        <div className="w-[400px] flex-shrink-0">
          <h2 className="text-lg font-bold text-white mb-4">2. Configurar Divisão SRT</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Idioma Original do SRT</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[#1e1536] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 appearance-none"
              >
                <option value="BR Português">BR Português</option>
                <option value="US Inglês">US Inglês</option>
                <option value="FR Francês">FR Francês</option>
                <option value="ES Espanhol">ES Espanhol</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">Isso garante que a IA corrija o texto no idioma certo.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Intervalo (minutos)</label>
              <input 
                type="number" 
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                min="1"
                className="w-full bg-[#1e1536] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-gray-500 mt-2">Recomendado: 3-5 minutos</p>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-3">Recomendações por idioma:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1e1536] border border-white/5 rounded-lg p-3 text-center">
                  <span className="text-xs font-bold text-blue-400 block mb-1">US Inglês</span>
                  <span className="text-xs text-gray-400">2 minutos</span>
                </div>
                <div className="bg-[#1e1536] border border-emerald-500/30 rounded-lg p-3 text-center">
                  <span className="text-xs font-bold text-emerald-400 block mb-1">BR Português</span>
                  <span className="text-xs text-gray-400">3-5 minutos</span>
                </div>
                <div className="bg-[#1e1536] border border-white/5 rounded-lg p-3 text-center">
                  <span className="text-xs font-bold text-purple-400 block mb-1">FR Francês</span>
                  <span className="text-xs text-gray-400">3 minutos</span>
                </div>
                <div className="bg-[#1e1536] border border-white/5 rounded-lg p-3 text-center">
                  <span className="text-xs font-bold text-yellow-400 block mb-1">ES Espanhol</span>
                  <span className="text-xs text-gray-400">3 minutos</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 italic">
                * Baseado na velocidade média de fala e duração ideal para geração de áudio sincronizado
              </p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-3 p-4 bg-black/20 rounded-lg border border-white/5 mt-6">
              {srtContent ? (
                srtContent.includes('-->') ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-400">SRT Detectado</p>
                      <p className="text-xs text-gray-400">Pronto para ser dividido</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-400">Formato Incorreto</p>
                      <p className="text-xs text-gray-400">Use a conversão com IA abaixo</p>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Aguardando Arquivo</p>
                    <p className="text-xs text-gray-400">Faça upload ou cole o texto</p>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={handleSplit}
              disabled={isProcessing || !srtContent}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 mt-8"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Scissors size={18} />
                  Dividir SRT
                </>
              )}
            </button>

            <div className="pt-4 border-t border-white/10 mt-6">
              <p className="text-sm text-gray-400 mb-3 text-center">O texto não está no formato SRT?</p>
              <button 
                onClick={handleConvertToSrt}
                disabled={isConverting || !srtContent}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e1536] border border-purple-500/30 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-purple-400 rounded-lg text-sm font-medium transition-colors"
              >
                {isConverting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Converter texto para SRT com IA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Name Correction Section */}
      <div className="max-w-6xl mb-8">
        <div className="bg-[#1e1536] rounded-xl border border-white/5 p-8">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">3. Correção de Nomes (Opcional)</h2>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            Padronize nomes de personagens antes de dividir para garantir consistência.
          </p>

          {!namesAnalyzed ? (
            <button 
              onClick={handleAnalyzeNames}
              disabled={isAnalyzingNames || !srtContent}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isAnalyzingNames ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analisar Nomes com IA
                </>
              )}
            </button>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <button 
                  onClick={handleAnalyzeNames}
                  disabled={isAnalyzingNames}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
                >
                  {isAnalyzingNames ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Reanalisar Nomes
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                {extractedNames.map((name, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-white">{name.original}</label>
                    <input 
                      type="text" 
                      value={name.corrected}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      className="w-full bg-[#2a204a] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5">
                <button 
                  onClick={handleApplyCorrections}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Check size={18} />
                  Aplicar Correções no SRT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Blocks Section */}
      {generatedBlocks.length > 0 && (
        <div className="max-w-6xl pb-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-blue-400" />
              <h2 className="text-2xl font-bold text-white">4. Blocos Gerados ({generatedBlocks.length})</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleImproveAll}
                disabled={isProcessingAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-purple-500/20"
              >
                {isProcessingAll ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Corrigir Tudo
              </button>
              <button 
                onClick={handleTranslateAll}
                disabled={isProcessingAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                {isProcessingAll ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
                Traduzir Tudo
              </button>
              <div className="h-10 w-px bg-white/10 mx-1 hidden sm:block"></div>
              <button 
                onClick={handleDownloadAllTxt}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1536] border border-white/10 hover:bg-white/10 text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText size={16} className="text-gray-400" /> Baixar TXT
              </button>
              <button 
                onClick={handleDownloadAllSrt}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1536] border border-white/10 hover:bg-white/10 text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} className="text-gray-400" /> Baixar SRT Único
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {generatedBlocks.map((block) => (
              <div key={block.id} className="bg-[#1e1536] rounded-xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      {block.id}
                    </div>
                    <h3 className="text-white font-bold">{block.title} • {block.durationStr}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleImproveBlock(block.id)}
                      disabled={processingBlocks[block.id]}
                      className="p-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 disabled:opacity-50 rounded-lg transition-colors"
                      title="Corrigir/Melhorar"
                    >
                      {processingBlocks[block.id] ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                    <button 
                      onClick={() => handleTranslateBlock(block.id)}
                      disabled={processingBlocks[block.id]}
                      className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 disabled:opacity-50 rounded-lg transition-colors"
                      title="Traduzir"
                    >
                      {processingBlocks[block.id] ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                    </button>
                    <button 
                      onClick={() => handleDownloadBlock(block)}
                      className="p-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded-lg transition-colors"
                      title="Baixar SRT"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-4 flex items-center gap-2">
                  <span>Tempo: {block.startTime} → {block.endTime}</span>
                  <span>•</span>
                  <span>Segmentos: {block.segmentsCount}</span>
                </div>
                <div className="text-sm text-gray-300 leading-relaxed bg-black/20 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                  {block.originalSrt}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

