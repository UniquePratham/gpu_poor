// Enhanced data manager for GPU Poor application
// Handles data loading, caching, and auto-updates

import HardwareDataUpdater from './hardwareDataUpdater.js';

class DataManager {
  constructor() {
    this.updater = new HardwareDataUpdater();
    this.cache = {
      gpu: null,
      cpu: null,
      models: null,
      lastLoaded: null
    };
    this.initialized = false;
  }

  // Initialize data manager
  async initialize() {
    if (this.initialized) return this.cache;

    try {
      console.log('Initializing DataManager...');
      const data = await this.updater.getLatestData();

      this.cache = {
        gpu: data.gpuData,
        cpu: data.cpuData,
        models: data.modelData,
        lastLoaded: Date.now()
      };

      this.initialized = true;
      console.log('DataManager initialized successfully');
      return this.cache;
    } catch (error) {
      console.error('Failed to initialize DataManager:', error);
      // Load default data as fallback
      this.cache = {
        gpu: this.updater.getDefaultGPUData(),
        cpu: this.updater.getDefaultCPUData(),
        models: this.updater.getDefaultModelData(),
        lastLoaded: Date.now()
      };
      this.initialized = true;
      return this.cache;
    }
  }

  // Get GPU data
  async getGPUData() {
    if (!this.initialized) await this.initialize();
    return this.cache.gpu;
  }

  // Get CPU data
  async getCPUData() {
    if (!this.initialized) await this.initialize();
    return this.cache.cpu;
  }

  // Get model data
  async getModelData() {
    if (!this.initialized) await this.initialize();
    return this.cache.models;
  }

  // Get GPU list for dropdown
  getGPUList() {
    if (!this.cache.gpu) return [];
    return Object.keys(this.cache.gpu).sort();
  }

  // Get CPU list for dropdown
  getCPUList() {
    if (!this.cache.cpu) return [];
    return Object.keys(this.cache.cpu).sort();
  }

  // Get model list for autocomplete
  getModelList() {
    if (!this.cache.models) return [];
    return Object.keys(this.cache.models).sort();
  }

  // Search models with enhanced filtering
  searchModels(query, limit = 10) {
    if (!this.cache.models || !query) return [];

    const models = Object.keys(this.cache.models);
    const normalizedQuery = query.toLowerCase();

    // Score models based on relevance
    const scored = models.map(modelName => {
      const modelData = this.cache.models[modelName];
      const nameLower = modelName.toLowerCase();

      let score = 0;

      // Exact name match
      if (nameLower === normalizedQuery) score += 100;

      // Name starts with query
      if (nameLower.startsWith(normalizedQuery)) score += 50;

      // Name contains query
      if (nameLower.includes(normalizedQuery)) score += 20;

      // Family/size category matches
      if (modelData.family && modelData.family.toLowerCase().includes(normalizedQuery)) score += 15;
      if (modelData.size_category && modelData.size_category.toLowerCase().includes(normalizedQuery)) score += 10;

      // Boost popular models (if download count exists)
      if (modelData.downloads && modelData.downloads > 1000) score += 5;

      // Boost newer models
      const releaseYear = modelData.release_date ? parseInt(modelData.release_date.split('-')[0]) : 2020;
      if (releaseYear >= 2024) score += 8;
      else if (releaseYear >= 2023) score += 5;

      return { modelName, score, modelData };
    });

    // Filter and sort by score
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        name: item.modelName,
        displayName: this.formatModelDisplayName(item.modelName, item.modelData),
        family: item.modelData.family,
        size: item.modelData.size_category,
        year: item.modelData.release_date
      }));
  }

  // Format model name for display
  formatModelDisplayName(modelName, modelData) {
    const parts = modelName.split('/');
    const baseName = parts[parts.length - 1];
    const org = parts[0];
    const size = modelData.size_category || '';
    const family = modelData.family || '';

    if (family && size) {
      return `${family} ${size} (${org})`;
    }
    return `${baseName} (${org})`;
  }

  // Get model configuration by name
  getModelConfig(modelName) {
    if (!this.cache.models || !this.cache.models[modelName]) {
      console.warn(`Model ${modelName} not found in database`);
      return null;
    }
    return this.cache.models[modelName];
  }

  // Get GPU specifications
  getGPUSpecs(gpuName) {
    if (!this.cache.gpu || !this.cache.gpu[gpuName]) {
      console.warn(`GPU ${gpuName} not found in database`);
      return null;
    }
    return this.cache.gpu[gpuName];
  }

  // Get CPU specifications
  getCPUSpecs(cpuName) {
    if (!this.cache.cpu || !this.cache.cpu[cpuName]) {
      console.warn(`CPU ${cpuName} not found in database`);
      return null;
    }
    return this.cache.cpu[cpuName];
  }

  // Force data refresh
  async refreshData() {
    console.log('Forcing data refresh...');
    try {
      const data = await this.updater.forceUpdate();
      this.cache = {
        gpu: data.gpuData,
        cpu: data.cpuData,
        models: data.modelData,
        lastLoaded: Date.now()
      };
      return this.cache;
    } catch (error) {
      console.error('Failed to refresh data:', error);
      throw error;
    }
  }

  // Get data statistics
  getDataStats() {
    return {
      gpuCount: this.cache.gpu ? Object.keys(this.cache.gpu).length : 0,
      cpuCount: this.cache.cpu ? Object.keys(this.cache.cpu).length : 0,
      modelCount: this.cache.models ? Object.keys(this.cache.models).length : 0,
      lastUpdate: this.updater.getUpdateStatus(),
      lastLoaded: this.cache.lastLoaded ? new Date(this.cache.lastLoaded).toISOString() : null
    };
  }

  // Get GPU recommendations based on requirements
  getGPURecommendations(memoryRequirement, budget = null) {
    if (!this.cache.gpu) return [];

    const gpus = Object.entries(this.cache.gpu)
      .filter(([name, specs]) => specs.memory >= memoryRequirement)
      .map(([name, specs]) => ({
        name,
        ...specs,
        efficiency: specs.compute / specs.tdp, // Performance per watt
        memoryEfficiency: specs.memory / specs.tdp // Memory per watt
      }))
      .sort((a, b) => b.compute - a.compute); // Sort by compute performance

    return gpus.slice(0, 10); // Return top 10 recommendations
  }

  // Get model recommendations based on GPU capacity
  // availableMemory: number (GB)
  // options: { quant: string, contextLength: number, overheadFactor: number }
  getModelRecommendations(availableMemory, options = {}) {
    if (!this.cache.models) return [];

    const quant = (options.quant || 'fp16').toString();
    const contextLength = options.contextLength || 0; // tokens for KV cache
    const overheadFactor = options.overheadFactor || 1.0; // multiplicative overhead

    return Object.entries(this.cache.models)
      .map(([name, config]) => {
        // Estimate parameter count
        const paramCount = this.estimateParameters(config);

        // Determine bytes per parameter based on quantization (defaults to fp16=2 bytes)
        const bytesPerParam = this.bytesPerParamForQuant(quant);

        // Parameter memory in bytes
        const paramsBytes = paramCount * bytesPerParam;

        // Estimate KV cache memory (simple conservative approximation):
        // kvBytes = contextLength * hidden_size * num_layers * 2 (keys+values) * bytesPerParam
        const hidden = config.hidden_size || 4096;
        const layers = config.num_hidden_layers || 32;
        const kvBytes = contextLength > 0 ? contextLength * hidden * layers * 2 * bytesPerParam : 0;

        const totalBytes = (paramsBytes + kvBytes) * overheadFactor;
        const memoryGB = totalBytes / (1024 * 1024 * 1024);

        return {
          name,
          config,
          estimatedMemory: memoryGB,
          canRun: memoryGB <= availableMemory,
          paramCount,
          bytesPerParam,
          kvBytes
        };
      })
      .sort((a, b) => b.paramCount - a.paramCount) // Largest models first
      .slice(0, 15);
  }

  // Comprehensive memory calculation with detailed breakdown
  calculateDetailedMemory(modelName, options = {}) {
    const {
      quant = 'fp16',
      contextLength = 0,
      batchSize = 1,
      mode = 'inference', // 'inference', 'training', 'qlora'
      gradientCheckpointing = false,
      optimizer = 'adam'
    } = options;

    const config = this.getModelConfig(modelName) || {};
    const paramCount = this.estimateParameters(config);
    const bytesPerParam = this.bytesPerParamForQuant(quant);

    const hidden = config.hidden_size || 4096;
    const layers = config.num_hidden_layers || 32;
    const seqLength = contextLength || 2048;

    // Model Parameters (weights)
    const modelSizeGB = (paramCount * bytesPerParam) / (1024 ** 3);

    // KV Cache (for inference)
    const kvCacheGB = batchSize * seqLength * hidden * layers * 2 * 2 / (1024 ** 3); // fp16 for KV

    // Activation Memory (forward pass)
    let activationGB = 0;
    if (mode === 'inference') {
      // Inference activations (much smaller)
      activationGB = batchSize * seqLength * hidden * 4 / (1024 ** 3); // rough estimate
    } else {
      // Training activations (store for backward pass)
      if (gradientCheckpointing) {
        // Gradient checkpointing reduces activation memory
        activationGB = batchSize * seqLength * hidden * layers * 0.5 * 4 / (1024 ** 3);
      } else {
        activationGB = batchSize * seqLength * hidden * layers * 4 / (1024 ** 3);
      }
    }

    // Gradient Memory (training only)
    let gradientGB = 0;
    if (mode === 'training') {
      gradientGB = (paramCount * 4) / (1024 ** 3); // fp32 gradients
    } else if (mode === 'qlora') {
      // QLoRA only trains adapter weights (much smaller)
      gradientGB = (paramCount * 0.01 * 4) / (1024 ** 3); // ~1% of params
    }

    // Optimizer States (training only)
    let optimizerGB = 0;
    if (mode === 'training') {
      if (optimizer === 'adam' || optimizer === 'adamw') {
        // Adam: momentum + variance = 2x param count in fp32
        optimizerGB = (paramCount * 2 * 4) / (1024 ** 3);
      } else if (optimizer === 'sgd') {
        // SGD: momentum = 1x param count in fp32
        optimizerGB = (paramCount * 4) / (1024 ** 3);
      }
    } else if (mode === 'qlora') {
      // QLoRA optimizer states only for adapter
      optimizerGB = (paramCount * 0.01 * 2 * 4) / (1024 ** 3);
    }

    // CUDA + Framework Overhead (empirical estimates)
    const baseOverheadGB = 0.5; // Base CUDA context
    const frameworkOverheadGB = Math.max(1.0, modelSizeGB * 0.1); // ~10% of model size
    const cudaOverheadGB = baseOverheadGB + frameworkOverheadGB;

    const totalGB = modelSizeGB + kvCacheGB + activationGB + gradientGB + optimizerGB + cudaOverheadGB;

    return {
      total: Math.round(totalGB * 100) / 100,
      breakdown: {
        'Model Size': Math.round(modelSizeGB * 100) / 100,
        'KV Cache': Math.round(kvCacheGB * 100) / 100,
        'Activation Memory': Math.round(activationGB * 100) / 100,
        'Grad & Optimizer memory': Math.round((gradientGB + optimizerGB) * 100) / 100,
        'cuda + other overhead': Math.round(cudaOverheadGB * 100) / 100
      },
      details: {
        paramCount,
        bytesPerParam,
        mode,
        batchSize,
        contextLength: seqLength,
        gradientCheckpointing,
        optimizer
      }
    };
  }

  // Token/s performance estimation
  calculateTokenPerformance(modelName, gpuName, options = {}) {
    const {
      quant = 'fp16',
      contextLength = 2048
    } = options;

    const config = this.getModelConfig(modelName) || {};
    const gpuSpecs = this.getGPUSpecs(gpuName) || {};

    const paramCount = this.estimateParameters(config);

    // Estimate FLOPS per token (rough approximation)
    const flopsPerToken = paramCount * 2; // forward pass

    // GPU compute capability (TFLOPS to FLOPS)
    const gpuFlops = (gpuSpecs.compute || 10) * 1e12;

    // Memory bandwidth limitations
    const gpuBandwidth = (gpuSpecs.bandwidth || 500) * 1e9; // GB/s to bytes/s
    const bytesPerParam = this.bytesPerParamForQuant(quant);
    const modelBytes = paramCount * bytesPerParam;

    // Theoretical max tokens/s (compute bound)
    const computeBoundTokens = gpuFlops / flopsPerToken;

    // Theoretical max tokens/s (memory bound)
    const memoryBoundTokens = gpuBandwidth / modelBytes;

    // Reality: take the minimum and apply efficiency factors
    const rawTokensPerSec = Math.min(computeBoundTokens, memoryBoundTokens);
    const efficiency = this.getInferenceEfficiency(quant, contextLength);
    const actualTokensPerSec = rawTokensPerSec * efficiency;

    // Prompt processing vs generation
    const promptTokensPerSec = actualTokensPerSec * 10; // Parallel processing
    const promptProcessTime = contextLength / promptTokensPerSec;

    const isMemoryBound = memoryBoundTokens < computeBoundTokens;

    return {
      'Token per second': Math.round(actualTokensPerSec * 10) / 10,
      'ms per token': Math.round(1000 / actualTokensPerSec * 10) / 10,
      'Prompt process time (s)': Math.round(promptProcessTime * 10) / 10,
      'memory or compute bound?': isMemoryBound ? 'Memory' : 'Compute'
    };
  }

  // Training time estimation
  calculateTrainingTime(modelName, gpuName, options = {}) {
    const {
      batchSize = 1,
      contextLength = 2048,
      gradientCheckpointing = false
    } = options;

    const config = this.getModelConfig(modelName) || {};
    const gpuSpecs = this.getGPUSpecs(gpuName) || {};

    const paramCount = this.estimateParameters(config);

    // Training FLOPS: forward + backward = ~3x inference
    const flopsPerIteration = paramCount * 6 * batchSize * contextLength;

    const gpuFlops = (gpuSpecs.compute || 10) * 1e12;
    const utilizationFactor = gradientCheckpointing ? 0.7 : 0.8; // Checkpointing reduces efficiency

    const iterationTimeMs = (flopsPerIteration / (gpuFlops * utilizationFactor)) * 1000;

    // Memory vs compute bound for training
    const gpuBandwidth = (gpuSpecs.bandwidth || 500) * 1e9;
    const bytesPerIteration = paramCount * 12; // weights + gradients + optimizer states
    const memoryTimeMs = (bytesPerIteration / gpuBandwidth) * 1000;

    const actualTimeMs = Math.max(iterationTimeMs, memoryTimeMs);
    const isMemoryBound = memoryTimeMs > iterationTimeMs;

    return {
      'ms per iteration (forward + backward)': Math.round(actualTimeMs * 10) / 10,
      'memory or compute bound?': isMemoryBound ? 'Memory' : 'Compute'
    };
  }

  // Helper: inference efficiency based on quantization and context
  getInferenceEfficiency(quant, contextLength) {
    let baseEfficiency = 0.3; // Conservative base

    // Quantization efficiency
    if (quant.includes('fp16')) baseEfficiency = 0.4;
    else if (quant.includes('int8')) baseEfficiency = 0.5;
    else if (quant.includes('q4')) baseEfficiency = 0.6;
    else if (quant.includes('q2')) baseEfficiency = 0.7;

    // Context length penalty (longer contexts are less efficient)
    const contextPenalty = Math.max(0.5, 1 - (contextLength / 8192) * 0.3);

    return baseEfficiency * contextPenalty;
  }

  // Determine bytes-per-parameter for a given quant string
  bytesPerParamForQuant(quantString) {
    if (!quantString) return 2; // default fp16
    const q = quantString.toLowerCase();

    // Exact matches and heuristics for common quant families/modes
    if (q.includes('fp32')) return 4;
    if (q.includes('fp16') || q.includes('bf16')) return 2;
    if (q.includes('int8') || q.includes('8bit') || q.includes('bnb8')) return 1;

    // 4-bit quantizations (q4_0, q4_1, nf4, ggml q4, etc.) ~ 0.5 bytes per param
    if (q.includes('q4') || q.includes('4bit') || q.includes('nf4')) return 0.5;

    // 2-bit quantizations (q2, awq-2bit, etc.) ~ 0.25 bytes per param
    if (q.includes('q2') || q.includes('2bit')) return 0.25;

    // int4/awq variants that pack to 4 bits
    if (q.includes('int4') || q.includes('awq') || q.includes('ggml-q4')) return 0.5;

    // Fallback conservative default to fp16
    return 2;
  }

  // Estimate parameter count from config
  estimateParameters(config) {
    const vocab = config.vocab_size || 32000;
    const hidden = config.hidden_size || 4096;
    const layers = config.num_hidden_layers || 32;
    const intermediate = config.intermediate_size || hidden * 4;

    return vocab * hidden + layers * (4 * hidden * hidden + 3 * intermediate * hidden);
  }

  // Export data for backup
  exportData() {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: this.cache
    };
  }

  // Import data from backup
  importData(backupData) {
    if (backupData.version === '1.0' && backupData.data) {
      this.cache = backupData.data;
      this.cache.lastLoaded = Date.now();
      console.log('Data imported successfully');
      return true;
    }
    console.error('Invalid backup data format');
    return false;
  }
}

// Create singleton instance
const dataManager = new DataManager();

export default dataManager;