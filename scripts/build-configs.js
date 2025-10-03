#!/usr/bin/env node

/**
 * Build script to generate all_configs.json from the enhanced model database
 * This script combines the original configs with new model data
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const dataDir = path.join(srcDir, 'data');
const publicDir = path.join(__dirname, '..', 'public');
const docsDir = path.join(__dirname, '..', 'docs');

// Read the enhanced model database
function loadModelDatabase() {
  try {
    const modelDbPath = path.join(dataDir, 'model_database_2025.json');
    const modelData = JSON.parse(fs.readFileSync(modelDbPath, 'utf8'));
    console.log(`Loaded ${Object.keys(modelData).length} models from enhanced database`);
    return modelData;
  } catch (error) {
    console.error('Failed to load model database:', error);
    return {};
  }
}

// Read existing configs if they exist
function loadExistingConfigs() {
  try {
    const existingPath = path.join(publicDir, 'all_configs.json');
    if (fs.existsSync(existingPath)) {
      const existingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      console.log(`Loaded ${Object.keys(existingData).length} existing configs`);
      return existingData;
    }
  } catch (error) {
    console.log('No existing configs found, starting fresh');
  }
  return {};
}

// Merge model databases
function mergeModelData(existing, enhanced) {
  const merged = { ...existing };
  let addedCount = 0;
  let updatedCount = 0;

  for (const [modelName, modelConfig] of Object.entries(enhanced)) {
    if (merged[modelName]) {
      // Update existing model if enhanced data is more complete
      if (Object.keys(modelConfig).length > Object.keys(merged[modelName]).length) {
        merged[modelName] = modelConfig;
        updatedCount++;
      }
    } else {
      // Add new model
      merged[modelName] = modelConfig;
      addedCount++;
    }
  }

  console.log(`Merged models: ${addedCount} added, ${updatedCount} updated`);
  return merged;
}

// Write the merged data to all target locations
function writeConfigFiles(data) {
  const content = JSON.stringify(data, null, 2);

  // Ensure directories exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Write to public directory (for development)
  const publicPath = path.join(publicDir, 'all_configs.json');
  fs.writeFileSync(publicPath, content);
  console.log(`Written to public/all_configs.json (${Object.keys(data).length} models)`);

  // Write to docs directory (for production)
  const docsPath = path.join(docsDir, 'all_configs.json');
  fs.writeFileSync(docsPath, content);
  console.log(`Written to docs/all_configs.json (${Object.keys(data).length} models)`);
}

// Generate build info
function generateBuildInfo() {
  const buildInfo = {
    buildTime: new Date().toISOString(),
    version: '2024.12',
    models: Object.keys(mergedData).length,
    sources: [
      'Hugging Face API',
      'Community Database',
      'Manual Curation'
    ],
    lastUpdate: new Date().toISOString()
  };

  const buildInfoPath = path.join(publicDir, 'build-info.json');
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

  const docsBuildInfoPath = path.join(docsDir, 'build-info.json');
  fs.writeFileSync(docsBuildInfoPath, JSON.stringify(buildInfo, null, 2));

  console.log('Generated build info files');
  return buildInfo;
}

// Main build process
console.log('🚀 Building enhanced model configurations...');

const existingConfigs = loadExistingConfigs();
const enhancedModels = loadModelDatabase();
const mergedData = mergeModelData(existingConfigs, enhancedModels);

writeConfigFiles(mergedData);
const buildInfo = generateBuildInfo();

console.log('✅ Build completed successfully!');
console.log(`📊 Total models: ${buildInfo.models}`);
console.log(`⏰ Build time: ${buildInfo.buildTime}`);
console.log('');
console.log('Files generated:');
console.log('  - public/all_configs.json');
console.log('  - docs/all_configs.json');
console.log('  - public/build-info.json');
console.log('  - docs/build-info.json');