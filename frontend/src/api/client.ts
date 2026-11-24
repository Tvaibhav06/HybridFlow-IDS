import axios from 'axios'
import { API_CONFIG } from '@/config/api'
import type {
  TrafficFeatures,
  PredictionResponse,
  BatchPredictionResponse,
  HealthResponse,
  StatsResponse,
} from '@/types'

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// API functions
export const api = {
  health: () => apiClient.get<HealthResponse>('/health').then(r => r.data),
  predict: (features: TrafficFeatures) =>
    apiClient.post<PredictionResponse>('/predict', features).then(r => r.data),
  predictBatch: (records: TrafficFeatures[]) =>
    apiClient.post<BatchPredictionResponse>('/predict/batch', { records }).then(r => r.data),
  stats: () => apiClient.get<StatsResponse>('/stats').then(r => r.data),
  logs: (limit = 100) => apiClient.get<any[]>(`/logs?limit=${limit}`).then(r => r.data),
  resetStats: () => apiClient.delete('/stats/reset').then(r => r.data),
}
