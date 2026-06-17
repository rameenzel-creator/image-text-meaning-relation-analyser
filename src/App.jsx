import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Search, FileText, BarChart2, AlertTriangle, Settings as SettingsIcon,
  Image as ImageIcon, Upload, Loader2, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// --- State Management ---

const AppContext = createContext();

const initialState = {
  apiKey: localStorage.getItem('nim_api_key') || import.meta.env.VITE_NIM_API_KEY || '',
  enableThinking: localStorage.getItem('enable_thinking') !== 'false',
  pipelineMode: localStorage.getItem('pipeline_mode') || 'parallel', // 'parallel' or 'sequential'
  evidences: JSON.parse(localStorage.getItem('evidences')) || []
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_API_KEY':
      localStorage.setItem('nim_api_key', action.payload);
      return { ...state, apiKey: action.payload };
    case 'SET_THINKING':
      localStorage.setItem('enable_thinking', action.payload ? 'true' : 'false');
      return { ...state, enableThinking: action.payload };
    case 'SET_PIPELINE_MODE':
      localStorage.setItem('pipeline_mode', action.payload);
      return { ...state, pipelineMode: action.payload };
    case 'ADD_EVIDENCE':
      const newEvidences = [action.payload, ...state.evidences];
      localStorage.setItem('evidences', JSON.stringify(newEvidences));
      return { ...state, evidences: newEvidences };
    default:
      return state;
  }
}

// --- AI Agent Logic ---

const AGENT_PROMPTS = {
  agent1: "You are a multimodal communication analyst. Given an image and caption, identify examples of multimodal communication. Respond ONLY with valid JSON, no markdown, no explanation: { \"modality_types\": [], \"evidence_snippets\": [], \"interaction_type\": \"reinforcement|contradiction|anchorage|relay|elaboration\" }",
  agent2: "You analyze how captions alter or anchor image meaning. Respond ONLY with valid JSON, no markdown: { \"image_alone_meaning\": \"\", \"caption_effect\": \"\", \"combined_interpretation\": \"\", \"rhetorical_strategy\": \"\" }",
  agent3: "You measure visual grammar features using Kress & van Leeuwen's framework. Analyze salience, framing, information value, and modality. Respond ONLY with valid JSON, no markdown: { \"salience\": { \"dominant_element\": \"\", \"techniques\": [] }, \"framing\": { \"type\": \"\", \"description\": \"\" }, \"information_value\": { \"horizontal\": \"\", \"vertical\": \"\" }, \"modality_level\": \"high|mid|low\", \"visual_grammar_score\": 0 }",
  agent4: "You verify multimodal interpretations against Multimodal Discourse Analysis theory. Respond ONLY with valid JSON, no markdown: { \"theory_alignment\": \"strong|moderate|weak\", \"concepts_applied\": [], \"audience_positioning\": \"\", \"ideological_reading\": \"\", \"confidence_score\": 0 }",
  agent5: "You are a critical reviewer of multimodal analysis. Flag weak evidence, unsupported claims, missing context. Respond ONLY with valid JSON, no markdown: { \"flags\": [{ \"type\": \"weak_evidence|unclear_label|missing_context|questionable_conclusion\", \"detail\": \"\" }], \"overall_reliability\": \"high|medium|low\", \"suggested_revisions\": [] }",
  lead: "You are the lead research coordinator. Given outputs from 5 analysis agents, synthesize everything into a single unified Evidence Card. Respond ONLY with valid JSON, no markdown: { \"relation_type\": \"reinforcement|contradiction|anchorage|relay|elaboration\", \"salience_notes\": \"\", \"framing_observations\": \"\", \"caption_effect\": \"\", \"combined_interpretation\": \"\", \"audience_positioning\": \"\", \"theory_alignment\": \"strong|moderate|weak\", \"confidence_score\": 0, \"reliability\": \"high|medium|low\", \"flags\": [], \"visual_grammar_score\": 0, \"modality_level\": \"high|mid|low\" }"
};

async function callAgent(apiKey, systemPrompt, userText, imageBase64, enableThinking = true, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("/nvidia-api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.2-11b-vision-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: imageBase64 }
                },
                {
                  type: "text",
                  text: userText
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.7,
          top_p: 0.95,
          stream: false
        })
      });

      if (response.status === 429) {
        console.warn(`[API Rate Limit] Request throttled (429). Retry attempt ${attempt + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 3000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Malformed JSON response from API: ${responseText.substring(0, 200)}`);
      }

      if (data.error) throw new Error(data.error.message || "API Error");
      
      const text = data.choices[0]?.message?.content;
      if (!text) throw new Error("API response does not contain message content");

      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/({[\s\S]*})/);
      const clean = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text.trim();
      try {
        return JSON.parse(clean);
      } catch (e) {
        // Try to extract any JSON object from the text
        const objMatch = text.match(/{[\s\S]*}/);
        if (objMatch) {
          try { return JSON.parse(objMatch[0]); } catch (_) {}
        }
        throw new Error("Agent output is not valid JSON: " + text.substring(0, 100));
      }
    } catch (error) {
      if (attempt === retries) {
        console.error(`Agent failed after ${retries + 1} attempts:`, error.message);
        return { _error: error.message };
      }
      console.warn(`[API Retry] Attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// --- Components ---

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/analyze', icon: Search, label: 'Analyze' },
    { path: '/evidence', icon: FileText, label: 'Evidence Repo' },
    { path: '/charts', icon: BarChart2, label: 'Charts' },
    { path: '/review', icon: AlertTriangle, label: 'Review' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-card border-r border-gray-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-accent flex items-center gap-2">
          <ImageIcon className="w-6 h-6" />
          Multimodal Analyzer
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-accent/10 text-accent font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function Dashboard() {
  const { state } = useContext(AppContext);
  const { evidences } = state;

  const total = evidences.length;
  const avgConfidence = total ? Math.round(evidences.reduce((acc, ev) => acc + (ev.confidence_score || 0), 0) / total) : 0;

  const relCount = evidences.reduce((acc, ev) => {
    acc[ev.relation_type] = (acc[ev.relation_type] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.keys(relCount).map(key => ({ name: key, count: relCount[key] }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm">
          <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider">Total Analyses</h3>
          <p className="text-4xl font-bold text-gray-100 mt-2">{total}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm">
          <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider">Avg Confidence</h3>
          <p className="text-4xl font-bold text-accent mt-2">{avgConfidence}%</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm">
          <h3 className="text-sm text-gray-400 font-medium uppercase tracking-wider">High Reliability</h3>
          <p className="text-4xl font-bold text-green-500 mt-2">
            {evidences.filter(e => e.reliability === 'high').length}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm h-80">
            <h3 className="text-lg font-medium mb-4">Relation Types</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: 'none' }} />
                <Bar dataKey="count" fill="#7c6af7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Recent Analyses</h3>
            <div className="space-y-4">
              {evidences.slice(0, 4).map(ev => (
                <div key={ev.id} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                  <img src={ev.image_base64} alt="thumb" className="w-12 h-12 object-cover rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-medium line-clamp-1">{ev.caption || 'No caption'}</p>
                    <p className="text-xs text-gray-500">{new Date(ev.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-accent/20 text-accent">
                    {ev.relation_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Analyze() {
  const { state, dispatch } = useContext(AppContext);
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [context, setContext] = useState('');
  const [status, setStatus] = useState('idle'); // idle, running, done, error
  const [errorMsg, setErrorMsg] = useState('');
  const [steps, setSteps] = useState([
    { id: 'agent1', label: 'Evidence Agent', status: 'pending', error: '' },
    { id: 'agent2', label: 'Caption Agent', status: 'pending', error: '' },
    { id: 'agent3', label: 'Visual Grammar Agent', status: 'pending', error: '' },
    { id: 'agent4', label: 'Discourse Agent', status: 'pending', error: '' },
    { id: 'agent5', label: 'Review Agent', status: 'pending', error: '' },
    { id: 'lead', label: 'Synthesis Agent', status: 'pending', error: '' },
  ]);
  const [result, setResult] = useState(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 jpeg with quality 0.7 for optimal size & speed
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setImage(compressedBase64);
        console.log(`[Image Upload] Resized from ${img.width}x${img.height} to ${width}x${height}. Base64 size: ${(compressedBase64.length / 1024).toFixed(1)} KB`);
      };

      const reader = new FileReader();
      reader.onloadend = () => {
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const updateStep = (id, newStatus, errMsg = '') => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, error: errMsg } : s));
  };

  const runAnalysis = async () => {
    if (!state.apiKey) {
      alert("Please set your NVIDIA API key in Settings first.");
      return;
    }
    if (!image) {
      alert("Please upload an image.");
      return;
    }

    setStatus('running');
    setErrorMsg('');
    setResult(null);
    setSteps(steps.map(s => ({ ...s, status: 'pending', error: '' })));

    const userText = `Caption: ${caption}\nContext: ${context}`;
    let agentOutputs = {};

    const runAgentWithFallback = async (agentId, prompt, fallbackObj) => {
      updateStep(agentId, 'running');
      const startTime = performance.now();
      
      const res = await callAgent(state.apiKey, prompt, userText, image, state.enableThinking);
      
      const duration = ((performance.now() - startTime) / 1000).toFixed(1);
      if (res && !res._error) {
        updateStep(agentId, 'done');
        return res;
      } else {
        const errMsg = res?._error || 'Unknown error';
        console.warn(`[${agentId}] Failed after ${duration}s:`, errMsg);
        updateStep(agentId, 'error', errMsg);
        if (!errorMsg) setErrorMsg(errMsg);
        return fallbackObj;
      }
    };

    let out1, out2, out3, out4, out5;

    if (state.pipelineMode === 'parallel') {
      console.log("--- Starting Staggered Parallel Agent Analysis ---");
      const delay = (ms) => new Promise(r => setTimeout(r, ms));
      
      const results = await Promise.all([
        runAgentWithFallback('agent1', AGENT_PROMPTS.agent1, { modality_types: [], evidence_snippets: [], interaction_type: "unknown" }),
        delay(600).then(() => runAgentWithFallback('agent2', AGENT_PROMPTS.agent2, { image_alone_meaning: "", caption_effect: "", combined_interpretation: "", rhetorical_strategy: "" })),
        delay(1200).then(() => runAgentWithFallback('agent3', AGENT_PROMPTS.agent3, { salience: { dominant_element: "", techniques: [] }, framing: { type: "", description: "" }, information_value: { horizontal: "", vertical: "" }, modality_level: "low", visual_grammar_score: 0 })),
        delay(1800).then(() => runAgentWithFallback('agent4', AGENT_PROMPTS.agent4, { theory_alignment: "weak", concepts_applied: [], audience_positioning: "", ideological_reading: "", confidence_score: 0 })),
        delay(2400).then(() => runAgentWithFallback('agent5', AGENT_PROMPTS.agent5, { flags: [], overall_reliability: "low", suggested_revisions: [] }))
      ]);
      out1 = results[0];
      out2 = results[1];
      out3 = results[2];
      out4 = results[3];
      out5 = results[4];
    } else {
      console.log("--- Starting Sequential Agent Analysis ---");
      out1 = await runAgentWithFallback('agent1', AGENT_PROMPTS.agent1, { modality_types: [], evidence_snippets: [], interaction_type: "unknown" });
      out2 = await runAgentWithFallback('agent2', AGENT_PROMPTS.agent2, { image_alone_meaning: "", caption_effect: "", combined_interpretation: "", rhetorical_strategy: "" });
      out3 = await runAgentWithFallback('agent3', AGENT_PROMPTS.agent3, { salience: { dominant_element: "", techniques: [] }, framing: { type: "", description: "" }, information_value: { horizontal: "", vertical: "" }, modality_level: "low", visual_grammar_score: 0 });
      out4 = await runAgentWithFallback('agent4', AGENT_PROMPTS.agent4, { theory_alignment: "weak", concepts_applied: [], audience_positioning: "", ideological_reading: "", confidence_score: 0 });
      out5 = await runAgentWithFallback('agent5', AGENT_PROMPTS.agent5, { flags: [], overall_reliability: "low", suggested_revisions: [] });
    }
    
    console.log("--- All Initial Agents Complete. Starting Lead Synthesis Agent ---");
    updateStep('lead', 'running');
    const leadContextText = `Agent 1: ${JSON.stringify(out1)}\nAgent 2: ${JSON.stringify(out2)}\nAgent 3: ${JSON.stringify(out3)}\nAgent 4: ${JSON.stringify(out4)}\nAgent 5: ${JSON.stringify(out5)}`;

    const finalData = await callAgent(state.apiKey, AGENT_PROMPTS.lead, leadContextText, image, state.enableThinking);

    if (finalData && !finalData._error) {
      updateStep('lead', 'done');
      const evidenceCard = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        image_base64: image,
        caption,
        context,
        ...finalData,
        // Guarantee that the Review Agent's detailed output isn't summarized away by the Lead agent
        flags: out5?.flags || finalData.flags || [],
        reliability: out5?.overall_reliability || finalData.reliability || 'high'
      };
      setResult(evidenceCard);
      setStatus('done');
    } else {
      const errMsg = finalData?._error || 'Synthesis agent failed';
      updateStep('lead', 'error', errMsg);
      setErrorMsg(errMsg);
      setStatus('error');
    }
  };

  const saveResult = () => {
    dispatch({ type: 'ADD_EVIDENCE', payload: result });
    navigate('/evidence');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold text-gray-100">Analysis Workspace</h2>

        <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Target Image</label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-accent transition-colors relative" onClick={() => document.getElementById('imageUpload').click()}>
              {image ? (
                <img src={image} alt="preview" className="max-h-64 rounded shadow-lg" />
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-500 mb-3" />
                  <p className="text-gray-300">Click to upload image</p>
                  <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WEBP</p>
                </>
              )}
              <input id="imageUpload" type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Caption / Text Content</label>
            <textarea
              className="w-full bg-background border border-gray-700 rounded-lg p-3 text-gray-100 focus:outline-none focus:border-accent"
              rows="3"
              placeholder="Enter the caption or text associated with this image..."
              value={caption} onChange={e => setCaption(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Additional Context (Optional)</label>
            <textarea
              className="w-full bg-background border border-gray-700 rounded-lg p-3 text-gray-100 focus:outline-none focus:border-accent"
              rows="2"
              placeholder="Source, audience, cultural context..."
              value={context} onChange={e => setContext(e.target.value)}
            />
          </div>

          <button
            className="w-full bg-accent hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={runAnalysis}
            disabled={status === 'running' || !image}
          >
            {status === 'running' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {status === 'running' ? 'Running Analysis...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card p-6 rounded-xl border border-gray-800">
          <h3 className="text-lg font-medium mb-4">Pipeline Status</h3>
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id}>
                <div className="flex items-center gap-3">
                  {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-600" />}
                  {step.status === 'running' && <Loader2 className="w-5 h-5 text-accent animate-spin" />}
                  {step.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {step.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                  <span className={`text-sm ${step.status === 'pending' ? 'text-gray-500' : step.status === 'error' ? 'text-red-400' : 'text-gray-200'}`}>
                    {step.label}
                  </span>
                </div>
                {step.error && (
                  <p className="text-xs text-red-400 mt-1 ml-8 bg-red-500/10 px-2 py-1 rounded">{step.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        {errorMsg && status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red-400 mb-1 flex items-center gap-2"><XCircle className="w-4 h-4" /> Analysis Failed</h4>
            <p className="text-xs text-red-300">{errorMsg}</p>
            {errorMsg.includes('401') && <p className="text-xs text-yellow-400 mt-2">⚠️ Check your API key in Settings.</p>}
            {errorMsg.includes('CORS') && <p className="text-xs text-yellow-400 mt-2">⚠️ CORS error — try a different browser or network.</p>}
          </div>
        )}

        {result && (
          <div className="bg-card p-6 rounded-xl border border-accent border-opacity-50 shadow-[0_0_15px_rgba(124,106,247,0.1)]">
            <h3 className="text-lg font-bold text-accent flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5" /> Analysis Complete
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-background p-3 rounded">
                <span className="text-sm text-gray-400">Relation</span>
                <span className="text-sm font-medium capitalize px-2 py-1 rounded bg-gray-800">{result.relation_type}</span>
              </div>
              <div className="flex justify-between items-center bg-background p-3 rounded">
                <span className="text-sm text-gray-400">Confidence</span>
                <span className="text-sm font-medium">{result.confidence_score}%</span>
              </div>
              <div className="flex justify-between items-center bg-background p-3 rounded">
                <span className="text-sm text-gray-400">Reliability</span>
                <span className={`text-sm font-medium capitalize ${result.reliability === 'high' ? 'text-green-500' : result.reliability === 'medium' ? 'text-yellow-500' : 'text-red-500'}`}>
                  {result.reliability}
                </span>
              </div>
            </div>
            <button
              onClick={saveResult}
              className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 rounded-lg transition-colors"
            >
              Save to Repository
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceRepo() {
  const { state } = useContext(AppContext);
  const [filter, setFilter] = useState('all');

  const filtered = state.evidences.filter(ev => filter === 'all' || ev.relation_type === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-100">Evidence Repository</h2>
        <select
          className="bg-card border border-gray-700 text-gray-200 rounded-lg p-2 focus:outline-none focus:border-accent"
          value={filter} onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Relations</option>
          <option value="reinforcement">Reinforcement</option>
          <option value="contradiction">Contradiction</option>
          <option value="anchorage">Anchorage</option>
          <option value="relay">Relay</option>
          <option value="elaboration">Elaboration</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(ev => (
          <div key={ev.id} className="bg-card border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-colors">
            <div className="h-48 bg-gray-900 relative">
              <img src={ev.image_base64} alt="evidence" className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3 flex gap-2">
                <span className="px-2 py-1 text-xs font-medium rounded shadow bg-black/70 backdrop-blur text-white capitalize">
                  {ev.relation_type}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded shadow backdrop-blur capitalize ${ev.reliability === 'high' ? 'bg-green-500/20 text-green-400' : ev.reliability === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {ev.reliability}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-300 line-clamp-2">{ev.caption || 'No caption provided'}</p>
              <div className="h-px bg-gray-800 w-full" />
              <p className="text-xs text-gray-400 line-clamp-3" title={ev.combined_interpretation}>
                <span className="font-semibold text-gray-200">Interpretation:</span> {ev.combined_interpretation}
              </p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">{new Date(ev.timestamp).toLocaleDateString()}</span>
                <span className="text-xs font-medium text-accent">Score: {ev.confidence_score}%</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No evidence cards found.
          </div>
        )}
      </div>
    </div>
  );
}

function Charts() {
  const { state } = useContext(AppContext);
  const { evidences } = state;

  const relCount = evidences.reduce((acc, ev) => {
    acc[ev.relation_type] = (acc[ev.relation_type] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.keys(relCount).map(key => ({ name: key, value: relCount[key] }));
  const COLORS = ['#7c6af7', '#00C49F', '#FFBB28', '#FF8042', '#ff6b6b'];

  const confData = evidences.map(e => ({ name: e.id.substring(0, 4), score: e.confidence_score }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Charts & Reports</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm h-80">
          <h3 className="text-lg font-medium mb-4">Relation Type Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: 'none', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-sm h-80">
          <h3 className="text-lg font-medium mb-4">Confidence Scores</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={confData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" tick={false} />
              <YAxis stroke="#888" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="score" fill="#00C49F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel() {
  const { state } = useContext(AppContext);

  // Safely normalise a flag — it might be a string or a {type, detail} object
  const normaliseFlag = (flag) => {
    if (!flag) return null;
    if (typeof flag === 'string') return { type: 'note', detail: flag };
    if (typeof flag === 'object' && (flag.type || flag.detail)) return flag;
    return null;
  };

  const flagged = state.evidences.filter(ev => {
    const flags = Array.isArray(ev.flags) ? ev.flags : [];
    return ev.reliability !== 'high' || flags.length > 0;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">Review Panel</h2>
      <p className="text-gray-400">Items flagged by the Review Agent for low reliability or weak evidence.</p>

      <div className="space-y-4">
        {flagged.map(ev => {
          const flags = (Array.isArray(ev.flags) ? ev.flags : [])
            .map(normaliseFlag)
            .filter(Boolean);

          return (
            <div key={ev.id} className="bg-card border border-red-500/20 p-5 rounded-xl flex gap-6">
              <img src={ev.image_base64} alt="thumb" className="w-24 h-24 object-cover rounded shadow" />
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-200">Relation: <span className="capitalize text-accent">{ev.relation_type}</span></h4>
                    <p className="text-sm text-gray-500 mt-1">Score: {ev.confidence_score}% | Reliability: <span className="text-red-400 capitalize">{ev.reliability}</span></p>
                  </div>
                </div>
                {flags.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Flags</span>
                    {flags.map((flag, idx) => (
                      <div key={idx} className="bg-red-500/10 text-red-300 px-3 py-2 rounded text-sm border border-red-500/20 flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <strong>{(flag.type || 'note').replace(/_/g, ' ')}:</strong> {flag.detail || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {flagged.length === 0 && (
          <div className="bg-card p-8 rounded-xl border border-gray-800 text-center text-green-500 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10" />
            <p className="font-medium">All clear! No items require review.</p>
            {state.evidences.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Run an analysis first to generate evidence cards.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function Settings() {
  const { state, dispatch } = useContext(AppContext);
  const [key, setKey] = useState(state.apiKey);
  const [thinking, setThinking] = useState(state.enableThinking);
  const [mode, setMode] = useState(state.pipelineMode);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dispatch({ type: 'SET_API_KEY', payload: key });
    dispatch({ type: 'SET_THINKING', payload: thinking });
    dispatch({ type: 'SET_PIPELINE_MODE', payload: mode });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-100">Settings</h2>

      <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">NVIDIA NIM API Key</label>
          <p className="text-xs text-gray-500">Required to use the AI models. Stored locally in your browser.</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-background border border-gray-700 rounded-lg p-3 text-gray-100 focus:outline-none focus:border-accent font-mono"
            placeholder="nvapi-..."
          />
        </div>

        <div className="border-t border-gray-800"></div>

        {/* Thinking Mode */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <input
              id="enable-thinking"
              type="checkbox"
              checked={thinking}
              onChange={(e) => setThinking(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-700 text-accent focus:ring-accent bg-background cursor-pointer"
            />
            <div className="flex-1">
              <label htmlFor="enable-thinking" className="block text-sm font-medium text-gray-300 cursor-pointer select-none">
                Enable Deep Thinking Mode (Gemma 4 Reasoning)
              </label>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                When enabled, the model generates an internal thinking process before returning its analysis.
                While this yields higher-quality reasoning, it can make agent execution take 2-3 minutes per agent.
                <br />
                <span className="text-accent font-medium">Disable this if you want fast (2-5 seconds) results without wait times.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800"></div>

        {/* Pipeline Mode */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">Pipeline Concurrency Mode</label>
          <p className="text-xs text-gray-500">
            Control how the 5 analysis agents are executed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${mode === 'parallel' ? 'bg-accent/5 border-accent text-gray-200' : 'bg-background border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pipelineMode"
                  value="parallel"
                  checked={mode === 'parallel'}
                  onChange={() => setMode('parallel')}
                  className="w-4 h-4 text-accent border-gray-700 bg-background focus:ring-accent"
                />
                <span className="text-sm font-semibold">Staggered Parallel (Recommended)</span>
              </div>
              <span className="text-xs text-gray-500 mt-2 leading-relaxed">
                Agents execute concurrently with a brief staggered start. Fastest overall analysis runtime.
              </span>
            </label>

            <label className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-all ${mode === 'sequential' ? 'bg-accent/5 border-accent text-gray-200' : 'bg-background border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pipelineMode"
                  value="sequential"
                  checked={mode === 'sequential'}
                  onChange={() => setMode('sequential')}
                  className="w-4 h-4 text-accent border-gray-700 bg-background focus:ring-accent"
                />
                <span className="text-sm font-semibold">Sequential</span>
              </div>
              <span className="text-xs text-gray-500 mt-2 leading-relaxed">
                Agents execute one by one. Useful for avoiding concurrent API limits, but takes longer overall.
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full md:w-auto bg-accent hover:bg-indigo-500 text-white font-medium py-2.5 px-8 rounded-lg transition-colors mt-2"
        >
          {saved ? 'Settings Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <BrowserRouter>
        <div className="flex h-screen bg-background overflow-hidden text-gray-200 selection:bg-accent/30 selection:text-white">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analyze" element={<Analyze />} />
                <Route path="/evidence" element={<EvidenceRepo />} />
                <Route path="/charts" element={<Charts />} />
                <Route path="/review" element={<ReviewPanel />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
