// Type definitions for persona-related API interactions

import type { JsonObject } from './common'

export interface PersonaSearchRequest {
  query: string;
  industry?: string;
  category?: string;
  min_authority?: number;
  limit?: number;
}

export interface PersonaSearchResponse {
  success: boolean;
  data: PersonaSearchResult[];
  message: string;
}

export interface PersonaSearchResult {
  id: string;
  role_title: string;
  role_category: string;
  company_id: string;
  authority_level: number;
  expertise: string[];
  priorities: string[];
  confidence_score: number;
}

export interface PersonaDetailsResponse {
  success: boolean;
  data: ScrapedPersona;
  message: string;
}

export interface ScrapedPersona {
  id: string;
  role_title: string;
  role_category: string;
  company_id: string;
  authority_level: number;
  expertise: string[];
  priorities: string[];
  responsibilities: string[];
  decision_authority: string[];
  stakeholders: string[];
  decision_style: string;
  communication_style: string;
  company_context: JsonObject;
  industry_context: JsonObject;
  system_prompt: string;
  confidence_score: number;
  generated_at: string;
}

export interface PersonaImportRequest {
  persona_ids: string[];
  organization_id: string;
  customize?: boolean;
}

export interface PersonaImportResponse {
  success: boolean;
  data: ImportedAgent[];
  message: string;
}

export interface ImportedAgent {
  id: string;
  name: string;
  role: string;
  organization_id: string;
  authority_level: number;
  status: string;
  metadata: {
    imported_from_persona: boolean;
    persona_id: string;
    company_context?: JsonObject;
    confidence_score: number;
    generated_at: string;
    job_posting_id: string;
  };
}

export interface CompaniesResponse {
  success: boolean;
  data: CompanyProfile[];
  message: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  greenhouse_url: string;
  industry: string;
  mission?: string;
  values: string[];
  size?: string;
  departments: string[];
  scraped_at: string;
  metadata: JsonObject;
}

export interface TemplatesResponse {
  success: boolean;
  data: PersonaTemplate[];
  message: string;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  category: string;
  industry: string;
  usage_count: number;
  success_rate: number;
  expertise_preview: string[];
}

export interface ScrapeRequest {
  greenhouse_url: string;
  industry: string;
  max_jobs?: number;
  generate_personas?: boolean;
}

export interface ScrapeResponse {
  task_id: string;
  status: string;
  message: string;
  company_id?: string;
  jobs_found: number;
  personas_generated: number;
}

export interface StatisticsResponse {
  success: boolean;
  data: {
    companies_by_industry: Record<string, number>;
    total_jobs: number;
    jobs_by_level: Record<string, number>;
    total_personas: number;
    personas_by_category: Record<string, number>;
    total_templates: number;
    template_total_usage: number;
  };
  message: string;
}

// Filter and search interfaces
export interface PersonaFilters {
  industry?: string;
  company?: string;
  roleCategory?: string;
  authorityLevel?: [number, number];
  confidenceScore?: [number, number];
}

export interface PersonaSearchState {
  query: string;
  filters: PersonaFilters;
  results: PersonaSearchResult[];
  selectedPersonas: string[];
  loading: boolean;
  error?: string;
}

// Import workflow interfaces
export interface ImportWorkflowState {
  step: 'search' | 'select' | 'preview' | 'import' | 'complete';
  searchState: PersonaSearchState;
  selectedPersonas: ScrapedPersona[];
  importSettings: {
    organizationId: string;
    customize: boolean;
  };
  importResults?: ImportedAgent[];
  loading?: boolean;
  error?: string;
  warning?: string;
}