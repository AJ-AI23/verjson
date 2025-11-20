import { useState, useEffect } from 'react';
import { ConsistencyConfig, DEFAULT_CONFIG, ConsistencyPreset } from '@/types/consistency';

const STORAGE_KEY = 'qa-consistency-config';

export const PRESET_CONFIGS: ConsistencyPreset[] = [
  {
    name: 'REST API Best Practices',
    description: 'Standard RESTful API conventions',
    config: {
      ...DEFAULT_CONFIG,
      queryParameterNaming: { enabled: true, caseType: 'kebab-case', exclusions: [] },
      pathParameterNaming: { enabled: true, caseType: 'kebab-case', exclusions: [] },
      endpointNaming: { enabled: true, caseType: 'kebab-case', exclusions: [] },
      propertyNaming: { enabled: true, caseType: 'camelCase', exclusions: [] },
      operationIdNaming: { enabled: true, caseType: 'camelCase', exclusions: [], alternatives: [] }
    }
  },
  {
    name: 'Google API Style Guide',
    description: 'Google\'s API design patterns',
    config: {
      ...DEFAULT_CONFIG,
      queryParameterNaming: { enabled: true, caseType: 'snake_case', exclusions: [] },
      pathParameterNaming: { enabled: true, caseType: 'snake_case', exclusions: [] },
      endpointNaming: { enabled: true, caseType: 'snake_case', exclusions: [] },
      propertyNaming: { enabled: true, caseType: 'snake_case', exclusions: [] },
      operationIdNaming: { enabled: true, caseType: 'snake_case', exclusions: [], alternatives: [] }
    }
  },
  {
    name: 'Microsoft API Guidelines',
    description: 'Microsoft\'s REST API guidelines',
    config: {
      ...DEFAULT_CONFIG,
      queryParameterNaming: { enabled: true, caseType: 'camelCase', exclusions: [] },
      pathParameterNaming: { enabled: true, caseType: 'camelCase', exclusions: [] },
      endpointNaming: { enabled: true, caseType: 'camelCase', exclusions: [] },
      propertyNaming: { enabled: true, caseType: 'camelCase', exclusions: [] },
      operationIdNaming: { enabled: true, caseType: 'camelCase', exclusions: [], alternatives: [] }
    }
  }
];

export function useConsistencyConfig() {
  const [config, setConfig] = useState<ConsistencyConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    console.log('=== Loading consistency config from localStorage ===');
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    console.log('Raw saved config:', savedConfig);
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        console.log('Parsed saved config:', parsed);
        const mergedConfig = { ...DEFAULT_CONFIG, ...parsed };
        console.log('Final merged config:', mergedConfig);
        setConfig(mergedConfig);
      } catch (error) {
        console.error('Failed to parse consistency config:', error);
        console.log('Using default config due to parse error');
        setConfig(DEFAULT_CONFIG);
      }
    } else {
      console.log('No saved config found, using default');
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  // Listen for configuration updates from other components
  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const newConfig = (event as CustomEvent<ConsistencyConfig>).detail;
      setConfig(newConfig);
    };

    window.addEventListener('consistencyConfigUpdated', handleUpdate as EventListener);
    return () =>
      window.removeEventListener('consistencyConfigUpdated', handleUpdate as EventListener);
  }, []);

  const updateConfig = (newConfig: ConsistencyConfig) => {
    console.log('=== Updating consistency config ===');
    console.log('New config being saved:', newConfig);
    
    setConfig(newConfig);
    const configToSave = JSON.stringify(newConfig);
    localStorage.setItem(STORAGE_KEY, configToSave);
    console.log('Saved to localStorage:', configToSave);
    
    // Dispatch a custom event to notify other components of config change
    window.dispatchEvent(new CustomEvent('consistencyConfigUpdated', { 
      detail: newConfig 
    }));
    
    console.log('Config update complete');
  };

  const applyPreset = (preset: ConsistencyPreset) => {
    const newConfig = { ...preset.config, presetName: preset.name };
    updateConfig(newConfig);
  };

  const resetToDefault = () => {
    updateConfig(DEFAULT_CONFIG);
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'consistency-config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importConfig = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedConfig = JSON.parse(event.target?.result as string);
          updateConfig({ ...DEFAULT_CONFIG, ...importedConfig });
          resolve();
        } catch (error) {
          reject(new Error('Invalid configuration file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  return {
    config,
    updateConfig,
    applyPreset,
    resetToDefault,
    exportConfig,
    importConfig,
    presets: PRESET_CONFIGS
  };
}