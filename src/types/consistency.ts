export interface NamingAlternative {
  prefix?: string;
  suffix?: string;
  method?: string;
}

export interface NamingConvention {
  enabled: boolean;
  caseType: 'kebab-case' | 'camelCase' | 'snake_case' | 'PascalCase' | 'custom';
  customPattern?: string;
  exclusions?: string[];
  prefix?: string;
  suffix?: string;
  alternatives?: NamingAlternative[];
}

export interface SemanticRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  pattern?: string;
  message?: string;
}

export interface ConsistencyConfig {
  queryParameterNaming: NamingConvention;
  pathParameterNaming: NamingConvention;
  componentNaming: NamingConvention;
  endpointNaming: NamingConvention;
  propertyNaming: NamingConvention;
  operationIdNaming: NamingConvention;
  semanticRules: SemanticRule[];
  presetName?: string;
}

export interface ConsistencyIssue {
  type: string;
  message: string;
  path: string;
  value?: string;
  suggestion?: string;
  suggestedName?: string;
  suggestedEnum?: string[];
  convention?: string;
  parameterType?: string;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
  details?: string;
}

export interface ConsistencyPreset {
  name: string;
  description: string;
  config: ConsistencyConfig;
}

export const DEFAULT_SEMANTIC_RULES: SemanticRule[] = [
  {
    id: 'required-description',
    name: 'Required Description',
    description: 'Endpoints and schemas should have descriptions',
    enabled: true,
    severity: 'warning',
    message: 'Missing description field'
  },
  {
    id: 'description-min-length',
    name: 'Description Minimum Length',
    description: 'Descriptions should be at least 10 characters',
    enabled: true,
    severity: 'info',
    pattern: '.{10,}',
    message: 'Description should be at least 10 characters'
  },
  {
    id: 'version-format',
    name: 'Version Format',
    description: 'API version should follow semantic versioning',
    enabled: true,
    severity: 'error',
    pattern: '^\\d+\\.\\d+\\.\\d+$',
    message: 'Version should follow semantic versioning (e.g., 1.0.0)'
  },
  {
    id: 'operationid-required',
    name: 'Operation ID Required',
    description: 'All operations should have unique operationId',
    enabled: true,
    severity: 'warning',
    message: 'Missing operationId field'
  },
  {
    id: 'http-status-codes',
    name: 'Standard HTTP Status Codes',
    description: 'Use standard HTTP status codes',
    enabled: true,
    severity: 'warning',
    message: 'Non-standard HTTP status code'
  }
];

export const DEFAULT_CONFIG: ConsistencyConfig = {
  queryParameterNaming: {
    enabled: true,
    caseType: 'kebab-case',
    exclusions: []
  },
  pathParameterNaming: {
    enabled: true,
    caseType: 'kebab-case',
    exclusions: []
  },
  componentNaming: {
    enabled: true,
    caseType: 'PascalCase',
    exclusions: []
  },
  endpointNaming: {
    enabled: true,
    caseType: 'kebab-case',
    exclusions: []
  },
  propertyNaming: {
    enabled: true,
    caseType: 'camelCase',
    exclusions: []
  },
  operationIdNaming: {
    enabled: true,
    caseType: 'camelCase',
    exclusions: [],
    alternatives: []
  },
  semanticRules: DEFAULT_SEMANTIC_RULES
};