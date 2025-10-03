import React, { useState, useEffect } from 'react';
import dataManager from '../services/dataManager';

const DataUpdateStatus = () => {
  const [stats, setStats] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    loadStats();
    // Check for updates every hour
    const interval = setInterval(loadStats, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      await dataManager.initialize();
      const dataStats = dataManager.getDataStats();
      setStats(dataStats);
      setLastUpdate(dataStats.lastUpdate);
    } catch (error) {
      console.error('Failed to load data stats:', error);
    }
  };

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatus('Checking for latest GPU and model data...');
    
    try {
      await dataManager.refreshData();
      setUpdateStatus('✅ Update completed successfully!');
      await loadStats();
      
      setTimeout(() => {
        setUpdateStatus('');
      }, 3000);
    } catch (error) {
      console.error('Update failed:', error);
      setUpdateStatus('❌ Update failed. Using cached data.');
      
      setTimeout(() => {
        setUpdateStatus('');
      }, 5000);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!stats) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="animate-pulse text-gray-500">Loading data statistics...</div>
      </div>
    );
  }

  const getUpdateStatusColor = () => {
    if (!lastUpdate?.needsUpdate) return 'text-green-600';
    if (lastUpdate?.daysSinceUpdate < 45) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUpdateStatusIcon = () => {
    if (!lastUpdate?.needsUpdate) return '✅';
    if (lastUpdate?.daysSinceUpdate < 45) return '⚠️';
    return '🔄';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          📊 Database Status
        </h3>
        <button
          onClick={handleForceUpdate}
          disabled={isUpdating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isUpdating ? (
            <span className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Updating...
            </span>
          ) : (
            '🔄 Refresh Data'
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">{stats.gpuCount}</div>
          <div className="text-sm text-blue-800">GPU Models</div>
          <div className="text-xs text-blue-600 mt-1">Including RTX 50/40/30 series, H100, A100</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">{stats.cpuCount}</div>
          <div className="text-sm text-green-800">CPU Models</div>
          <div className="text-xs text-green-600 mt-1">AMD Zen 4/5, Intel 12th-14th gen</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">{stats.modelCount}</div>
          <div className="text-sm text-purple-800">AI Models</div>
          <div className="text-xs text-purple-600 mt-1">Llama, GPT, Mistral, Qwen, etc.</div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${getUpdateStatusColor()}`}>
              <span className="mr-2">{getUpdateStatusIcon()}</span>
              <span className="font-medium">
                {lastUpdate?.needsUpdate ? 'Update Available' : 'Up to Date'}
              </span>
            </div>
            
            {lastUpdate?.lastUpdate && (
              <div className="text-gray-600">
                Last updated: {new Date(lastUpdate.lastUpdate).toLocaleDateString()}
                {lastUpdate.daysSinceUpdate !== null && (
                  <span className="ml-1">
                    ({lastUpdate.daysSinceUpdate} days ago)
                  </span>
                )}
              </div>
            )}
          </div>
          
          {lastUpdate?.nextUpdate && (
            <div className="text-gray-500 text-xs">
              Next check: {new Date(lastUpdate.nextUpdate).toLocaleDateString()}
            </div>
          )}
        </div>

        {updateStatus && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            {updateStatus}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500">
          <p>
            🔄 <strong>Auto-Update:</strong> Data refreshes automatically every 30 days from multiple sources including 
            Hugging Face, GPU databases, and manufacturer specifications.
          </p>
          <p className="mt-1">
            📡 <strong>Sources:</strong> Hugging Face API, TechPowerUp GPU Database, manufacturer datasheets, 
            and community-maintained databases for the most accurate specifications.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataUpdateStatus;