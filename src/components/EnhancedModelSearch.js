import React, { useState, useEffect, useRef } from 'react';
import dataManager from '../services/dataManager';

const EnhancedModelSearch = ({ 
  value, 
  onChange, 
  placeholder = "Search for AI models (e.g., Llama, GPT, Mistral)...",
  onModelSelect = null 
}) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [popularModels, setPopularModels] = useState([]);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load popular models on component mount
  useEffect(() => {
    loadPopularModels();
  }, []);

  // Update local state when value prop changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const loadPopularModels = async () => {
    try {
      await dataManager.initialize();
      const models = dataManager.getModelList();
      
      // Get popular/recent models for initial display
      const popular = models
        .filter(name => {
          const config = dataManager.getModelConfig(name);
          return config && (
            name.includes('llama') || 
            name.includes('mistral') || 
            name.includes('qwen') || 
            name.includes('phi') ||
            name.includes('gemma')
          );
        })
        .slice(0, 8)
        .map(name => {
          const config = dataManager.getModelConfig(name);
          return {
            name,
            displayName: dataManager.formatModelDisplayName(name, config),
            family: config.family,
            size: config.size_category
          };
        });
      
      setPopularModels(popular);
    } catch (error) {
      console.error('Failed to load popular models:', error);
    }
  };

  const handleInputChange = async (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onChange(newQuery);
    
    if (newQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      await dataManager.initialize();
      const results = dataManager.searchModels(newQuery, 12);
      setSuggestions(results);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search failed:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.name);
    onChange(suggestion.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    if (onModelSelect) {
      const config = dataManager.getModelConfig(suggestion.name);
      onModelSelect(suggestion.name, config);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (query.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    } else if (query.length < 2 && popularModels.length > 0) {
      setSuggestions(popularModels);
      setShowSuggestions(true);
    }
  };

  const handleBlur = (e) => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const ModelSuggestionItem = ({ suggestion, isSelected, onClick }) => (
    <div
      className={`px-4 py-3 cursor-pointer border-l-4 transition-all duration-150 ${
        isSelected 
          ? 'bg-blue-50 border-blue-500 text-blue-900' 
          : 'hover:bg-gray-50 border-transparent hover:border-gray-300'
      }`}
      onClick={() => onClick(suggestion)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {suggestion.displayName || suggestion.name}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {suggestion.family && (
              <span className="inline-block bg-gray-100 px-2 py-1 rounded mr-2">
                {suggestion.family}
              </span>
            )}
            {suggestion.size && (
              <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {suggestion.size}
              </span>
            )}
          </div>
        </div>
        {suggestion.year && (
          <div className="text-xs text-gray-400 ml-2">
            {suggestion.year}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          autoComplete="off"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {showSuggestions && (suggestions.length > 0 || popularModels.length > 0) && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {query.length < 2 && popularModels.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                Popular Models
              </div>
              {popularModels.map((suggestion, index) => (
                <ModelSuggestionItem
                  key={suggestion.name}
                  suggestion={suggestion}
                  isSelected={index === selectedIndex}
                  onClick={handleSuggestionClick}
                />
              ))}
            </>
          )}
          
          {query.length >= 2 && suggestions.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                Search Results ({suggestions.length})
              </div>
              {suggestions.map((suggestion, index) => (
                <ModelSuggestionItem
                  key={suggestion.name}
                  suggestion={suggestion}
                  isSelected={index === selectedIndex}
                  onClick={handleSuggestionClick}
                />
              ))}
            </>
          )}
          
          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="px-4 py-6 text-center text-gray-500">
              <div className="text-sm">No models found for "{query}"</div>
              <div className="text-xs mt-1">Try searching for "llama", "mistral", or "qwen"</div>
            </div>
          )}
        </div>
      )}
      
      {query && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Tip: You can search by model name, family (e.g., "Llama"), or size (e.g., "7B")
        </div>
      )}
    </div>
  );
};

export default EnhancedModelSearch;