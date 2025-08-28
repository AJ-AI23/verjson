import { useState, useEffect } from 'react';
import { ConsistencyConfig, DEFAULT_CONFIG, ConsistencyPreset } from '@/types/consistency';

const STORAGE_KEY = 'qa-consistency-config';

export const PRESET_CONFIGS: ConsistencyPreset[] = [
  {
    name: 'REST API Best Practices',
    description: 'Standard RESTful API conventions',
    config: {
      ...DEFAULT_CONFIG,
      parameterNaming: { caseType: 'kebab-case', exclusions: [] },
      endpointNaming: { caseType: 'kebab-case', exclusions: [] },
      propertyNaming: { caseType: 'camelCase', exclusions: [] }
    }
  },
  {
    name: 'Google API Style Guide',
    description: 'Google\'s API design patterns',
    config: {
      ...DEFAULT_CONFIG,
      parameterNaming: { caseType: 'snake_case', exclusions: [] },
      endpointNaming: { caseType: 'snake_case', exclusions: [] },
      propertyNaming: { caseType: 'snake_case', exclusions: [] }
    }
  },
  {
    name: 'Microsoft API Guidelines',
    description: 'Microsoft\'s REST API guidelines',
    config: {
      ...DEFAULT_CONFIG,
      parameterNaming: { caseType: 'camelCase', exclusions: [] },
      endpointNaming: { caseType: 'camelCase', exclusions: [] },
      propertyNaming: { caseType: 'camelCase', exclusions: [] }
    }
  }
];

export function useConsistencyConfig() {
  const [config, setConfig] = useState<ConsistencyConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (error) {
        console.error('Failed to parse consistency config:', error);
      }
    }
  }, []);

  const updateConfig = (newConfig: ConsistencyConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    
    // Dispatch a custom event to notify other components of config change
    window.dispatchEvent(new CustomEvent('consistencyConfigUpdated', { 
      detail: newConfig 
    }));
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