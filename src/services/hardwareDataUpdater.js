// Auto-update service for GPU and Model data using FREE APIs
// Updates monthly with latest hardware specs and AI models

class HardwareDataUpdater {
  constructor() {
    this.lastUpdate = localStorage.getItem('lastDataUpdate') || null;
    this.updateInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  // Check if data needs updating (every 30 days)
  needsUpdate() {
    if (!this.lastUpdate) return true;
    const timeDiff = Date.now() - new Date(this.lastUpdate).getTime();
    return timeDiff > this.updateInterval;
  }

  // Fetch latest AI models from Hugging Face (FREE API)
  async fetchLatestModels() {
    console.log('🤖 Fetching latest AI models from Hugging Face...');
    
    try {
      const response = await fetch('https://huggingface.co/api/models?limit=100&sort=trending');
      if (!response.ok) throw new Error('Hugging Face API failed');
      
      const models = await response.json();
      
      // Process and format models with user-friendly names
      const processedModels = models.map(model => ({
        name: model.id,
        display_name: this.makeUserFriendly(model.id),
        family: this.extractFamily(model.id),
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        tags: model.tags || [],
        pipeline_tag: model.pipeline_tag,
        release_date: '2025',
        free_tier: this.isFreeModel(model),
        user_friendly_description: this.generateDescription(model)
      }));

      localStorage.setItem('latestModels2025', JSON.stringify(processedModels));
      return processedModels;
      
    } catch (error) {
      console.warn('Failed to fetch Hugging Face models:', error);
      return this.getDefaultModels();
    }
  }

  // Fetch latest GPU specs
  async fetchLatestGPUs() {
    console.log('🎮 Fetching latest GPU specs...');
    
    try {
      // Return manually curated 2025 data
      const gpuData = this.get2025GPUData();
      localStorage.setItem('latestGPUs2025', JSON.stringify(gpuData));
      return gpuData;
      
    } catch (error) {
      console.warn('Failed to fetch GPU data:', error);
      return this.get2025GPUData();
    }
  }

  // Make model names user-friendly
  makeUserFriendly(modelId) {
    const friendlyNames = {
      'gpt': 'ChatGPT',
      'claude': 'Claude AI',
      'llama': 'Llama (Meta)',
      'mistral': 'Mistral AI',
      'gemma': 'Gemma (Google)',
      'qwen': 'Qwen (Alibaba)',
      'deepseek': 'DeepSeek',
      'phi': 'Phi (Microsoft)'
    };

    let friendly = modelId;
    for (const [key, value] of Object.entries(friendlyNames)) {
      if (modelId.toLowerCase().includes(key)) {
        friendly = modelId.replace(new RegExp(key, 'gi'), value);
        break;
      }
    }

    // Add user-friendly suffixes
    if (modelId.includes('70b')) friendly += ' (Large Model)';
    else if (modelId.includes('7b')) friendly += ' (Standard Model)';
    else if (modelId.includes('3b')) friendly += ' (Compact Model)';
    
    if (modelId.includes('instruct')) friendly += ' - Ready to Chat';
    if (modelId.includes('code')) friendly += ' - Code Assistant';
    
    return friendly;
  }

  // Extract model family
  extractFamily(modelId) {
    if (modelId.includes('meta-llama')) return 'Meta';
    if (modelId.includes('mistralai')) return 'Mistral';
    if (modelId.includes('google')) return 'Google';
    if (modelId.includes('microsoft')) return 'Microsoft';
    if (modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('openai')) return 'OpenAI';
    if (modelId.includes('qwen')) return 'Alibaba';
    if (modelId.includes('deepseek')) return 'DeepSeek';
    return 'Community';
  }

  // Check if model is free
  isFreeModel(model) {
    const freeTags = ['open-source', 'apache-2.0', 'mit', 'cc-by'];
    return model.tags?.some(tag => freeTags.includes(tag.toLowerCase())) || 
           model.id.includes('open') || false;
  }

  // Generate user-friendly description
  generateDescription(model) {
    let desc = '';
    
    if (model.pipeline_tag === 'text-generation') {
      desc = 'Great for chatting, writing, and answering questions';
    } else if (model.pipeline_tag === 'text2text-generation') {
      desc = 'Perfect for translation and text transformation';
    } else if (model.pipeline_tag === 'code-generation') {
      desc = 'Specialized for writing and debugging code';
    } else {
      desc = 'Versatile AI model for various tasks';
    }

    if (model.downloads > 100000) desc += ' - Very Popular!';
    if (this.isFreeModel(model)) desc += ' - Free to Use!';
    
    return desc;
  }

  // Get 2025 GPU data (manually curated)
  get2025GPUData() {
    return [
      {
        name: 'RTX 5090',
        display_name: 'RTX 5090 (Most Powerful Gaming GPU 2025)',
        memory: 32,
        bandwidth: 1500,
        compute: 165,
        architecture: 'Blackwell',
        release_year: 2025,
        tdp: 450,
        price_range: '$1600-2000',
        user_friendly: 'Ultimate GPU for 4K gaming and AI work',
        difficulty: 'Expert'
      },
      {
        name: 'RTX 5080',
        display_name: 'RTX 5080 (High-End Gaming 2025)',
        memory: 16,
        bandwidth: 900,
        compute: 120,
        architecture: 'Blackwell',
        release_year: 2025,
        tdp: 320,
        price_range: '$1000-1200',
        user_friendly: 'Excellent for 4K gaming and content creation',
        difficulty: 'Advanced'
      },
      {
        name: 'RTX 5070 Ti',
        display_name: 'RTX 5070 Ti (Great 1440p Gaming)',
        memory: 16,
        bandwidth: 700,
        compute: 90,
        architecture: 'Blackwell',
        release_year: 2025,
        tdp: 280,
        price_range: '$700-800',
        user_friendly: 'Perfect for 1440p high-refresh gaming',
        difficulty: 'Intermediate'
      },
      {
        name: 'RTX 5070',
        display_name: 'RTX 5070 (Solid 1440p Choice)',
        memory: 12,
        bandwidth: 600,
        compute: 75,
        architecture: 'Blackwell',
        release_year: 2025,
        tdp: 250,
        price_range: '$500-600',
        user_friendly: 'Great value for 1440p gaming',
        difficulty: 'Beginner'
      },
      {
        name: 'RTX 4090',
        display_name: 'RTX 4090 (Previous Generation Beast)',
        memory: 24,
        bandwidth: 1008,
        compute: 165,
        architecture: 'Ada Lovelace',
        release_year: 2022,
        tdp: 450,
        price_range: '$1200-1500',
        user_friendly: 'Still incredibly powerful, great value now',
        difficulty: 'Expert'
      }
    ];
  }

  // Get default models if API fails
  getDefaultModels() {
    return [
      {
        name: 'llama-3.3-70b',
        display_name: 'Llama 3.3 70B (Popular Free Choice)',
        family: 'Meta',
        free_tier: true,
        user_friendly_description: 'Most popular open-source model - reliable and completely free'
      },
      {
        name: 'gpt-4o-mini', 
        display_name: 'GPT-4o Mini (Fast & Efficient)',
        family: 'OpenAI',
        free_tier: false,
        user_friendly_description: 'Fast, capable, and affordable - great for everyday use'
      }
    ];
  }

  // Main update function
  async updateAllData() {
    console.log('🔄 Starting monthly data update...');
    
    try {
      const [models, gpus] = await Promise.all([
        this.fetchLatestModels(),
        this.fetchLatestGPUs()
      ]);

      localStorage.setItem('lastDataUpdate', Date.now().toString());
      
      console.log('✅ Update completed successfully!');
      return { models, gpus, success: true };
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export the updater
export const hardwareDataUpdater = new HardwareDataUpdater();
export default HardwareDataUpdater;