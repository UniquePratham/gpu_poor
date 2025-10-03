import React, { useState, useRef, useMemo } from "react";
import './styles/App.css';
import Modal from "react-modal";
import gpuJSONData from "./data/gpu_database_2025.json";
import cpuJSONData from "./data/cpu_database_2025.json";
import modelJSONData from "./data/model_database_2025.json";
import userFriendlyModels from "./data/user_friendly_models_2025.json";
import dataManager from './services/dataManager';
import TextInput from "./components/TextInput";

function App() {
    const [modelName, setModelName] = useState("");
    const [modelSize, setModelSize] = useState("");
    const [promptLen, setPromptLen] = useState("");
    const [contextLen, setContextLen] = useState("");
    const [batchSize, setBatchSize] = useState("1");
    const [numGPUs, setNumGPUs] = useState("1");
    const [tokensToGenerate, setTokensToGenerate] = useState("50");

    const [totalMemoryShown, setTotalMemoryShown] = useState("");
    const [numGPUINeed, setNumGPUINeed] = useState("");
    const [computedTokenPerSecond, setComputedTokenPerSecond] = useState("");
    const [computedSecondsToGenerate, setComputedSecondsToGenerate] = useState("");

    const [showTable, setShowTable] = useState(false);
    const [showTableComputeToken, setShowTableComputeToken] = useState(false);
    const [showTableTraining, setShowTableTraining] = useState(false);
    const [showTrainGradientCheck, setShowTrainGradientCheck] = useState(false);

    const [breakDownMemoryJson, setBreakDownMemoryJson] = useState({});
    const [trainingResultsJson, setTrainingResultsJson] = useState({});

    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [modalModelContent, setModalModelContent] = useState("");
    const [copyStatus, setCopyStatus] = useState("");

    const [selections, setSelections] = useState({
        dropdownTrnOrNot: "inf",
        dropdownTrnMethod: "full",
        dropdownOptimizer: "adam",
        // quant now split into family + mode for better UX
        dropdownQuantFamily: "none",
        dropdownQuantMode: "",
        isGPUorCPU: "usingGPU",
        dropdownGPU: Object.keys(gpuJSONData)[0] || "rtx-5090",
        dropdownCPU: Object.keys(cpuJSONData)[0] || "9950x"
    });

    // Text generation states
    const [displayedText, setDisplayedText] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const intervalRef = useRef(null);

    // Autocomplete states - combine model DB and user-friendly list
    const friendlyMap = userFriendlyModels.reduce((acc, m) => {
        acc[m.name] = m.display_name || m.name;
        return acc;
    }, {});

    const combinedModels = Array.from(
        new Set([
            ...Object.keys(modelJSONData),
            ...userFriendlyModels.map((m) => m.name),
        ])
    );

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);

    const handleMemoryCalculation = () => {
        // Real memory calculation using dataManager
        const quant = getQuantString();
        const contextLength = parseInt(contextLen || '0', 10) || 0;
        const batchSz = parseInt(batchSize || '1', 10) || 1;
        const mode = selections.dropdownTrnOrNot === 'inf' || selections.dropdownTrnOrNot === 'inf_vLLM' || selections.dropdownTrnOrNot === 'inf_ggml'
            ? 'inference'
            : selections.dropdownTrnOrNot === 'qlora'
                ? 'qlora'
                : 'training';

        const targetModel = modelName || 'meta-llama/Llama-2-7b-hf';

        const detailedMemory = dataManager.calculateDetailedMemory(targetModel, {
            quant,
            contextLength,
            batchSize: batchSz,
            mode,
            gradientCheckpointing: showTrainGradientCheck,
            optimizer: selections.dropdownOptimizer
        });

        // Calculate GPUs needed
        const isGPU = selections.isGPUorCPU === 'usingGPU';
        const hwKey = isGPU ? selections.dropdownGPU : selections.dropdownCPU;
        const hwData = isGPU ? gpuJSONData[hwKey] : cpuJSONData[hwKey];
        const hwMemoryGB = hwData && hwData.memory ? parseFloat(hwData.memory) : 24;
        const gpusNeeded = Math.max(1, Math.ceil(detailedMemory.total / hwMemoryGB));

        setTotalMemoryShown(`${detailedMemory.total.toFixed(2)} GB`);
        setNumGPUINeed(`${gpusNeeded}`);
        setBreakDownMemoryJson(detailedMemory.breakdown);
        setShowTable(true);
        setShowTableComputeToken(false);
        setShowTableTraining(false);
    };

    const handleTokenCalculation = () => {
        const quant = getQuantString();
        const contextLength = parseInt(contextLen || '0', 10) || 0;
        const batchSz = parseInt(batchSize || '1', 10) || 1;
        const isGPU = selections.isGPUorCPU === 'usingGPU';
        const hwKey = isGPU ? selections.dropdownGPU : selections.dropdownCPU;
        const targetModel = modelName || 'meta-llama/Llama-2-7b-hf';
        const gpuName = isGPU ? hwKey : 'cpu';

        const tokenPerformance = dataManager.calculateTokenPerformance(targetModel, gpuName, {
            quant,
            contextLength,
            batchSize: batchSz,
            mode: selections.dropdownTrnOrNot === 'inf' || selections.dropdownTrnOrNot === 'inf_vLLM' || selections.dropdownTrnOrNot === 'inf_ggml' ? 'inference' : 'training'
        });

        // Update the UI with comprehensive performance data
        setComputedTokenPerSecond(tokenPerformance['Token per second'].toString());
        setComputedSecondsToGenerate(tokenPerformance['Prompt process time (s)'].toString());

        // Store detailed breakdown in exact requested format
        setBreakDownMemoryJson({
            "Token per second": tokenPerformance['Token per second'],
            "ms per token": tokenPerformance['ms per token'],
            "Prompt process time (s)": tokenPerformance['Prompt process time (s)'],
            "memory or compute bound?": tokenPerformance['memory or compute bound?']
        });

        setShowTableComputeToken(true);
        setShowTable(false);
        setShowTableTraining(false);
    };

    const handleTrainingCalculation = () => {
        const quant = getQuantString();
        const contextLength = parseInt(contextLen || '0', 10) || 0;
        const batchSz = parseInt(batchSize || '1', 10) || 1;
        const isGPU = selections.isGPUorCPU === 'usingGPU';
        const hwKey = isGPU ? selections.dropdownGPU : selections.dropdownCPU;
        const targetModel = modelName || 'meta-llama/Llama-2-7b-hf';
        const gpuName = isGPU ? hwKey : 'cpu';

        const trainingResults = dataManager.calculateTrainingTime(targetModel, gpuName, {
            quant,
            contextLength,
            batchSize: batchSz,
            mode: selections.dropdownTrnOrNot === 'qlora' ? 'qlora' : 'training',
            gradientCheckpointing: showTrainGradientCheck,
            optimizer: selections.dropdownOptimizer
        });

        // Store training results in exact requested format
        setTrainingResultsJson({
            "ms per iteration (forward + backward)": trainingResults['ms per iteration (forward + backward)'],
            "memory or compute bound?": trainingResults['memory or compute bound?']
        });

        setShowTableTraining(true);
        setShowTable(false);
        setShowTableComputeToken(false);
    };

    const handleReset = () => {
        setModelName("");
        setModelSize("");
        setPromptLen("");
        setContextLen("");
        setBatchSize("1");
        setNumGPUs("1");
        setTokensToGenerate("50");
        setTotalMemoryShown("");
        setNumGPUINeed("");
        setComputedTokenPerSecond("");
        setComputedSecondsToGenerate("");
        setShowTable(false);
        setShowTableComputeToken(false);
        setShowTableTraining(false);
        setBreakDownMemoryJson({});
        setTrainingResultsJson({});
        setDisplayedText("");
        setIsVisible(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

    const handleShowHardwareSpecs = () => {
        const isGPU = selections.isGPUorCPU === "usingGPU";
        let key = isGPU ? selections.dropdownGPU : selections.dropdownCPU;
        const data = isGPU ? gpuJSONData[key] : cpuJSONData[key];

        if (!data) {
            setModalModelContent(`No data available for ${key}`);
            setModalIsOpen(true);
            return;
        }

        const lines = [];
        lines.push(`${isGPU ? "GPU" : "CPU"} ID: ${key}`);
        if (data.display_name) lines.push(`Name: ${data.display_name}`);
        if (data.name && !data.display_name) lines.push(`Name: ${data.name}`);
        if (data.architecture) lines.push(`Architecture: ${data.architecture}`);
        if (data.compute) lines.push(`Compute (TFLOPS or equivalent): ${data.compute}`);
        if (data.memory) lines.push(`Memory (GB): ${data.memory}`);
        if (data.bandwidth) lines.push(`Memory Bandwidth (GB/s): ${data.bandwidth}`);
        if (data.tdp) lines.push(`TDP (W): ${data.tdp}`);
        if (data.release_year) lines.push(`Release Year: ${data.release_year}`);
        if (data.price_range) lines.push(`Price Range: ${data.price_range}`);
        if (data.user_friendly) lines.push(`User Friendly: ${data.user_friendly}`);
        if (data.recommended_gpu) lines.push(`Recommended GPUs: ${data.recommended_gpu}`);
        if (data.notes) lines.push(`Notes: ${data.notes}`);
        const quantStr = getQuantString();
        if (quantStr) lines.push(`Selected quant: ${quantStr}`);
        setModalModelContent(lines.join("\n"));
        setModalIsOpen(true);
    };

    // Helper: returns a normalized quant string (e.g. 'bnb_q4_0' or '' for none)
    const getQuantString = () => {
        const fam = selections.dropdownQuantFamily;
        const mode = selections.dropdownQuantMode;
        if (!fam || fam === 'none') return '';
        if (fam === 'other') return mode || '';
        if (fam === 'bitsandbytes') return mode || '';
        if (fam === 'nf4') return mode || 'nf4';
        if (fam === 'awq') return mode || 'awq';
        if (fam === 'ggml') return mode || '';
        return mode || '';
    };

    const handleCopySpecs = async () => {
        if (!modalModelContent) return;
        try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(modalModelContent);
            } else {
                // fallback for older browsers
                const ta = document.createElement('textarea');
                ta.value = modalModelContent;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        } catch (err) {
            setCopyStatus('Copy failed');
            setTimeout(() => setCopyStatus(''), 2000);
        }
    };

    const handleGenerateText = () => {
        const tokenCount = parseInt(tokensToGenerate || '0', 10);
        const tokensPerSec = parseFloat(computedTokenPerSecond || '50');

        if (!tokenCount || tokenCount <= 0) return;

        setDisplayedText("");
        setIsVisible(true);

        // Create a robust text source that can generate any number of tokens
        const baseText = `The field of artificial intelligence has seen remarkable progress in recent years, driven by advances in machine learning, neural networks, and computational power. Large language models like GPT, Claude, and others have demonstrated impressive capabilities in natural language understanding and generation. These models require significant computational resources, particularly GPU memory, to operate effectively. Understanding the memory requirements and performance characteristics of different AI models is crucial for developers, researchers, and organizations looking to deploy these technologies efficiently. The cost of GPU hardware and cloud computing resources makes it essential to optimize model selection and configuration for specific use cases. Machine learning engineers must carefully balance model size, inference speed, and accuracy when deploying AI systems in production environments. The rapid evolution of hardware architectures continues to shape the landscape of artificial intelligence development and deployment.`;

        const words = baseText.split(" ").filter(word => word.trim() !== "");

        // Generate enough text to cover the requested tokens
        // 1 token ≈ 0.75 words, so we need more words than tokens
        const wordsNeeded = Math.ceil(tokenCount * 0.8);
        let extendedWords = [];

        // Repeat the base text as many times as needed
        for (let i = 0; i < wordsNeeded; i++) {
            extendedWords.push(words[i % words.length]);
        }

        let currentIndex = 0;
        const wordsPerSecond = tokensPerSec / 1.2; // Rough approximation
        const intervalTime = Math.max(30, 1000 / wordsPerSecond); // Minimum 30ms interval

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            if (currentIndex < wordsNeeded && currentIndex < extendedWords.length) {
                const word = extendedWords[currentIndex];
                if (word && word.trim() !== "") {
                    setDisplayedText(prev => prev + (currentIndex === 0 ? "" : " ") + word);
                }
                currentIndex++;
            } else {
                clearInterval(intervalRef.current);
            }
        }, intervalTime);
    }; const handleClearText = () => {
        setDisplayedText("");
        setIsVisible(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

    const closeModal = () => {
        setModalIsOpen(false);
        setModalModelContent("");
    };

    // Keep a single filtered suggestions array in sync with the UI
    const filteredSuggestions = useMemo(() => {
        const q = modelName ? modelName.toLowerCase() : "";
        return combinedModels.filter((item) => {
            const idMatch = item.toLowerCase().includes(q);
            const friendly = friendlyMap[item] || "";
            const friendlyMatch = friendly.toLowerCase().includes(q);
            return idMatch || friendlyMatch;
        });
    }, [modelName, combinedModels, friendlyMap]);

    const handleKeyDown = (e) => {
        // Ensure the suggestions list is visible while navigating with keyboard
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIdx((prevIdx) => Math.min(prevIdx + 1, filteredSuggestions.length - 1));
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIdx((prevIdx) => Math.max(prevIdx - 1, -1));
            return;
        }

        if (e.key === "Enter") {
            if (selectedIdx >= 0 && filteredSuggestions[selectedIdx]) {
                setModelName(filteredSuggestions[selectedIdx]);
            }
            setShowSuggestions(false);
            setSelectedIdx(-1);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={closeModal}
                    className="modal"
                    overlayClassName="modal-overlay"
                    style={{
                        content: {
                            position: 'fixed',
                            top: "50%",
                            left: "50%",
                            right: "auto",
                            bottom: "auto",
                            marginRight: "-50%",
                            transform: "translate(-50%, -50%)",
                            width: "600px",
                            maxWidth: "92vw",
                            maxHeight: "calc(100vh - 120px)",
                            overflowY: "auto",
                            WebkitOverflowScrolling: 'touch',
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #ffd700",
                            borderRadius: "10px",
                            padding: "20px",
                            color: "#ffd700",
                            zIndex: 10000
                        },
                        overlay: {
                            backgroundColor: "rgba(0, 0, 0, 0.8)",
                            zIndex: 9999
                        },
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            {copyStatus && (
                                <span style={{ color: '#a8ff8a', marginRight: '8px' }}>{copyStatus}</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={handleCopySpecs}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.9rem', padding: '0.3rem 0.6rem' }}
                            >
                                Copy specs
                            </button>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#ffd700",
                                    fontSize: "24px",
                                    cursor: "pointer",
                                    padding: "0",
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div>
                        <h2
                            style={{
                                color: "#ffd700",
                                marginBottom: "20px",
                                fontSize: "24px",
                            }}
                        >
                            💡 Model Details
                        </h2>
                        {modalModelContent && (
                            <div
                                style={{
                                    color: "#ffffff",
                                    lineHeight: "1.6",
                                    fontSize: "14px",
                                }}
                            >
                                <pre
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "'Courier New', monospace",
                                        backgroundColor: "#2a2a2a",
                                        padding: "15px",
                                        borderRadius: "5px",
                                        overflow: "auto",
                                        border: "1px solid #ffd700",
                                    }}
                                >
                                    {modalModelContent}
                                </pre>
                            </div>
                        )}
                    </div>
                </Modal>

                {/* Compact Header */}
                <div className="app-header" style={{ padding: "0.75rem 0" }}>
                    <div className="app-header-content">
                        <h1
                            className="app-title"
                            style={{
                                fontSize: "2.4rem",
                                lineHeight: "1.1",
                                letterSpacing: "0.5px"
                            }}
                        >
                            <img src={`${process.env.PUBLIC_URL}/logo512.png`} alt="App Logo" style={{ height: "3rem" }} />
                            Are you GPU poor?
                            <div
                                className="emoji-container ml-6"
                                style={{ transform: "scale(1.15)", transformOrigin: "left center" }}
                            >
                                <span
                                    className="emoji-hand -left-7"
                                    role="img"
                                    aria-label="flexed biceps"
                                    style={{ fontSize: "1.8rem" }}
                                >
                                    💪
                                </span>
                                <div
                                    className="emoji-circle"
                                    style={{ width: "2.1rem", height: "2.1rem", fontSize: "1.5rem" }}
                                >
                                    <span role="img" aria-label="smiling face with sunglasses">😎</span>
                                </div>
                                <span
                                    className="emoji-hand -right-7"
                                    role="img"
                                    aria-label="flexed biceps"
                                    style={{ transform: "scaleX(-1)", fontSize: "1.8rem" }}
                                >
                                    💪
                                </span>
                            </div>
                        </h1>
                        <p
                            className="app-subtitle"
                            style={{
                                fontSize: "1.05rem",
                                marginTop: "0.4rem",
                                letterSpacing: "0.3px"
                            }}
                        >
                            Calculate GPU memory requirement and token/s for any LLM
                        </p>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="main-content">
                    {/* Left Panel - Configuration */}
                    <div className="content-panel">
                        <div className="panel-header">
                            <span className="panel-title">🤖 Model Configuration</span>
                        </div>
                        <div className="panel-content">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Name (Huggingface ID)</label>
                                    <TextInput
                                        className="form-input"
                                        value={modelName}
                                        setValue={setModelName}
                                        setChange={(v) => {
                                            setShowSuggestions(!!v);
                                            if (v) setSelectedIdx(-1);
                                        }}
                                        handleKeyDown={handleKeyDown}
                                        placeholder="e.g. meta-llama/Llama-2-7b-hf"
                                    />
                                    {modelName && showSuggestions && (
                                        <ul className="suggestions-list">
                                            {filteredSuggestions.length > 0 ? (
                                                filteredSuggestions.map((item, index) => {
                                                    const label = friendlyMap[item]
                                                        ? `${item} — ${friendlyMap[item]}`
                                                        : item;
                                                    return (
                                                        <li
                                                            key={item}
                                                            onClick={() => {
                                                                setModelName(item);
                                                                setShowSuggestions(false);
                                                                setSelectedIdx(-1);
                                                            }}
                                                            className={`suggestion-item ${selectedIdx === index ? "active" : ""}`}
                                                        >
                                                            {label}
                                                        </li>
                                                    );
                                                })
                                            ) : (
                                                <li className="suggestion-item no-match">No matches — press Enter to use custom model ID</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Size (in Billion)</label>
                                    <input
                                        className="form-input"
                                        type="text"
                                        value={modelSize}
                                        onChange={(e) => setModelSize(e.target.value)}
                                        placeholder="e.g. for llama-7b enter 7"
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Train or Inference?</label>
                                    <select
                                        className="form-select"
                                        value={selections.dropdownTrnOrNot}
                                        onChange={(e) => {
                                            setSelections({
                                                ...selections,
                                                dropdownTrnOrNot: e.target.value
                                            });
                                        }}
                                    >
                                        <option value="inf">Inference (Huggingface)</option>
                                        <option value="inf_vLLM">Inference (vLLM)</option>
                                        <option value="inf_ggml">Inference (GGML / llama.cpp)</option>
                                        <option value="full_trn">Full Training</option>
                                        <option value="qlora">QLoRA Training</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Train method?</label>
                                    <select
                                        className="form-select"
                                        value={selections.dropdownTrnMethod}
                                        onChange={(e) => {
                                            setSelections({
                                                ...selections,
                                                dropdownTrnMethod: e.target.value
                                            });
                                        }}
                                    >
                                        <option value="full">Full</option>
                                        <option value="lora">LoRA</option>
                                        <option value="qlora">QLoRA</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Optimizer?</label>
                                    <select
                                        className="form-select"
                                        value={selections.dropdownOptimizer}
                                        onChange={(e) => {
                                            setSelections({
                                                ...selections,
                                                dropdownOptimizer: e.target.value
                                            });
                                        }}
                                    >
                                        <option value="adam">ADAM</option>
                                        <option value="sgd">SGD</option>
                                        <option value="adamw">AdamW</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Quant?</label>
                                    {/* Quant family selector + mode selector */}
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <select
                                            className="form-select"
                                            value={selections.dropdownQuantFamily}
                                            onChange={(e) => {
                                                const fam = e.target.value;
                                                setSelections({
                                                    ...selections,
                                                    dropdownQuantFamily: fam,
                                                    // reset mode when family changes
                                                    dropdownQuantMode: ''
                                                });
                                            }}
                                            style={{ flex: '0 0 45%' }}
                                        >
                                            <option value="none">None</option>
                                            <option value="bitsandbytes">bitsandbytes (bnb)</option>
                                            <option value="nf4">NF4</option>
                                            <option value="awq">AWQ</option>
                                            <option value="ggml">GGML (llama.cpp)</option>
                                            <option value="other">Other</option>
                                        </select>

                                        {/* Mode select or input */}
                                        {selections.dropdownQuantFamily === 'bitsandbytes' && (
                                            <select
                                                className="form-select"
                                                value={selections.dropdownQuantMode}
                                                onChange={(e) => setSelections({ ...selections, dropdownQuantMode: e.target.value })}
                                                style={{ flex: '1' }}
                                            >
                                                <option value="bnb_int8">8-bit (bnb_int8)</option>
                                                <option value="bnb_q4_0">4-bit (bnb_q4_0)</option>
                                                <option value="bnb_q4_k_m">4-bit (bnb_q4_k_m)</option>
                                            </select>
                                        )}

                                        {selections.dropdownQuantFamily === 'nf4' && (
                                            <select
                                                className="form-select"
                                                value={selections.dropdownQuantMode}
                                                onChange={(e) => setSelections({ ...selections, dropdownQuantMode: e.target.value })}
                                                style={{ flex: '1' }}
                                            >
                                                <option value="nf4">NF4</option>
                                            </select>
                                        )}

                                        {selections.dropdownQuantFamily === 'awq' && (
                                            <select
                                                className="form-select"
                                                value={selections.dropdownQuantMode}
                                                onChange={(e) => setSelections({ ...selections, dropdownQuantMode: e.target.value })}
                                                style={{ flex: '1' }}
                                            >
                                                <option value="awq">AWQ</option>
                                                <option value="awq_gs">AWQ-GS</option>
                                            </select>
                                        )}

                                        {selections.dropdownQuantFamily === 'ggml' && (
                                            <select
                                                className="form-select"
                                                value={selections.dropdownQuantMode}
                                                onChange={(e) => setSelections({ ...selections, dropdownQuantMode: e.target.value })}
                                                style={{ flex: '1' }}
                                            >
                                                <option value="ggml_Q2_K">GGML Q2_K</option>
                                                <option value="ggml_Q3_K_S">GGML Q3_K_S</option>
                                                <option value="ggml_Q3_K_M">GGML Q3_K_M</option>
                                                <option value="ggml_Q3_K_L">GGML Q3_K_L</option>
                                                <option value="ggml_Q4_0">GGML Q4_0</option>
                                                <option value="ggml_Q4_1">GGML Q4_1</option>
                                                <option value="ggml_Q4_K_S">GGML Q4_K_S</option>
                                                <option value="ggml_Q4_K_M">GGML Q4_K_M</option>
                                                <option value="ggml_Q4_K_L">GGML Q4_K_L</option>
                                                <option value="ggml_Q5_0">GGML Q5_0</option>
                                                <option value="ggml_Q5_1">GGML Q5_1</option>
                                                <option value="ggml_Q5_K_M">GGML Q5_K_M</option>
                                                <option value="ggml_Q6_K">GGML Q6_K</option>
                                                <option value="ggml_Q6_K_L">GGML Q6_K_L</option>
                                                <option value="ggml_Q6">GGML Q6</option>
                                                <option value="ggml_Q8_0">GGML Q8_0</option>
                                            </select>
                                        )}

                                        {selections.dropdownQuantFamily === 'other' && (
                                            <input
                                                className="form-input"
                                                type="text"
                                                placeholder="custom mode"
                                                value={selections.dropdownQuantMode}
                                                onChange={(e) => setSelections({ ...selections, dropdownQuantMode: e.target.value })}
                                                style={{ flex: '1' }}
                                            />
                                        )}

                                        {selections.dropdownQuantFamily === 'none' && (
                                            <select className="form-select" disabled style={{ flex: '1' }}>
                                                <option>None</option>
                                            </select>
                                        )}
                                    </div>
                                    <small className="text-muted">Select quant family first, then the exact mode. "Other" allows typing a custom mode.</small>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Prompt len?</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={promptLen}
                                        onChange={(e) => setPromptLen(e.target.value)}
                                        placeholder="?"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tokens to Generate?</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={contextLen}
                                        onChange={(e) => setContextLen(e.target.value)}
                                        placeholder="?"
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Batch-size?</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={batchSize}
                                        onChange={(e) => setBatchSize(e.target.value)}
                                        placeholder="1"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gradient Checkpointing?</label>
                                    <select
                                        className="form-select"
                                        value={showTrainGradientCheck ? "Yes" : "No"}
                                        onChange={(e) => setShowTrainGradientCheck(e.target.value === "Yes")}
                                    >
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                    <small className="text-muted">Only applicable for train</small>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">GPU or CPU?</label>
                                    <select
                                        className="form-select"
                                        value={selections.isGPUorCPU}
                                        onChange={(e) => {
                                            setSelections({
                                                ...selections,
                                                isGPUorCPU: e.target.value
                                            });
                                        }}
                                    >
                                        <option value="usingGPU">GPU</option>
                                        <option value="usingCPU">CPU</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {selections.isGPUorCPU === "usingGPU" ? "GPU" : "CPU"}
                                    </label>
                                    <select
                                        className="form-select"
                                        value={
                                            selections.isGPUorCPU === "usingGPU"
                                                ? selections.dropdownGPU
                                                : selections.dropdownCPU
                                        }
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (selections.isGPUorCPU === "usingGPU") {
                                                setSelections({ ...selections, dropdownGPU: value });
                                            } else {
                                                setSelections({ ...selections, dropdownCPU: value });
                                            }
                                        }}
                                    >
                                        {selections.isGPUorCPU === "usingGPU"
                                            ? Object.keys(gpuJSONData).map((gpu) => (
                                                <option key={gpu} value={gpu}>
                                                    {gpuJSONData[gpu].display_name || gpu.toUpperCase()}
                                                </option>
                                            ))
                                            : Object.keys(cpuJSONData).map((cpu) => (
                                                <option key={cpu} value={cpu}>
                                                    {cpuJSONData[cpu].display_name || cpu.toUpperCase()}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">No. of GPUs?</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={numGPUs}
                                    onChange={(e) => setNumGPUs(e.target.value)}
                                    placeholder="1"
                                />
                                <button
                                    className="btn btn-secondary"
                                    style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                    onClick={handleShowHardwareSpecs}
                                >
                                    Get GPU specs
                                </button>
                            </div>

                            <div className="button-group">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleMemoryCalculation}
                                >
                                    Find Memory requirement
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleTokenCalculation}
                                >
                                    Find ~/tokens/s
                                </button>
                                <button
                                    className="btn btn-warning"
                                    onClick={handleTrainingCalculation}
                                >
                                    Find Training Time
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleReset}
                                >
                                    CLEAR
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Results & Token Generation */}
                    <div className="content-panel">
                        <div className="panel-header">
                            <span className="panel-title">📊 Results & Token Generation</span>
                        </div>
                        <div className="panel-content">
                            {/* Token Generation Section */}
                            <div className="text-section">
                                <div className="form-group">
                                    <label className="form-label">How does X tokens/s look like?</label>
                                    <label className="form-label">Number of tokens to generate:</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={tokensToGenerate}
                                        onChange={(e) => setTokensToGenerate(e.target.value)}
                                        placeholder="50"
                                    />
                                    <div className="button-group" style={{ marginTop: '0.5rem' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleGenerateText}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                        >
                                            Generate Token
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={handleClearText}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    {isVisible && (
                                        <div className="token-display">
                                            <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                Generated at {computedTokenPerSecond || '50'} tokens/s:
                                            </p>
                                            <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                                                {displayedText}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Results Display */}
                            {showTable && (
                                <div className="results-section">
                                    <h4 className="text-gold" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                        Memory Requirements
                                    </h4>
                                    <div className="results-grid">
                                        <div className="result-card">
                                            <div className="result-value">{totalMemoryShown}</div>
                                            <div className="result-label">Total Memory</div>
                                        </div>
                                        <div className="result-card">
                                            <div className="result-value">{numGPUINeed}</div>
                                            <div className="result-label">GPUs Needed</div>
                                        </div>
                                    </div>
                                    {breakDownMemoryJson && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Component</th>
                                                        <th>Memory (GB)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(breakDownMemoryJson).map(([key, value]) => (
                                                        <tr key={key}>
                                                            <td>{key}</td>
                                                            <td>{typeof value === 'number' ? value.toFixed(2) : value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {showTableComputeToken && (
                                <div className="results-section">
                                    <h4 className="text-gold" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                        Token Performance Results
                                    </h4>
                                    <div className="results-grid">
                                        <div className="result-card">
                                            <div className="result-value">{computedTokenPerSecond}</div>
                                            <div className="result-label">Tokens/Second</div>
                                        </div>
                                        <div className="result-card">
                                            <div className="result-value">{computedSecondsToGenerate}s</div>
                                            <div className="result-label">Time to Generate</div>
                                        </div>
                                    </div>
                                    {breakDownMemoryJson && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Metric</th>
                                                        <th>Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(breakDownMemoryJson).map(([key, value]) => (
                                                        <tr key={key}>
                                                            <td>{key}</td>
                                                            <td>{typeof value === 'number' ? value.toFixed(2) : value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {showTableTraining && (
                                <div className="results-section">
                                    <h4 className="text-gold" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                        Training Performance Results
                                    </h4>
                                    {trainingResultsJson && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Metric</th>
                                                        <th>Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(trainingResultsJson).map(([key, value]) => (
                                                        <tr key={key}>
                                                            <td>{key}</td>
                                                            <td>{typeof value === 'number' ? value.toFixed(2) : value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Documentation & FAQ */}
                            <div className="footer-section">
                                <div className="footer-title">📚 Documentation & FAQ</div>
                                <div className="footer-text">
                                    This tool calculates GPU memory requirements and performance estimates for Large Language Models.
                                    Supports training (Full/LoRA/QLoRA) and inference (HuggingFace/vLLM/llama.cpp) with 2025 hardware data.
                                </div>
                                <div className="footer-links">
                                    <a href="https://github.com/UniquePratham/gpu_poor" className="footer-link" target="_blank" rel="noopener noreferrer">
                                        📖 GitHub Documentation
                                    </a>
                                    <a href="https://github.com/UniquePratham/gpu_poor/issues" className="footer-link" target="_blank" rel="noopener noreferrer">
                                        ❓ FAQ & Issues
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </div>
    );
}

export default App;