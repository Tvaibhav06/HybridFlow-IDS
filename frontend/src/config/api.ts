export const API_CONFIG = {
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  mockMode: (import.meta as any).env?.VITE_MOCK_MODE === 'true',
  pollInterval: Number((import.meta as any).env?.VITE_POLL_INTERVAL) || 5000,
}

export const ENDPOINTS = {
  health: '/health',
  predict: '/predict',
  predictBatch: '/predict/batch',
  stats: '/stats',
  logs: '/logs',
  reset: '/stats/reset',
} as const

export const UNIFIED_FEATURES = [
  'flow_duration', 'flow_iat_mean', 'flow_iat_std',
  'packet_count', 'fwd_packets', 'bwd_packets', 'fwd_bwd_ratio',
  'byte_count', 'fwd_bytes', 'bwd_bytes',
  'flow_bytes_per_sec', 'flow_packets_per_sec',
  'avg_packet_size', 'fwd_packet_size_mean', 'bwd_packet_size_mean',
  'syn_flag_count', 'ack_flag_count', 'rst_flag_count', 'fin_flag_count', 'psh_flag_count',
  'payload_length', 'payload_entropy',
  'fwd_header_length', 'bwd_header_length',
] as const

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#355670',
  medium: '#8F6522',
  high: '#99362E',
  critical: '#99362E',
}

export const ATTACK_COLORS: Record<string, string> = {
  BENIGN: '#355E3B',
  DDOS: '#99362E',
  DOS: '#99362E',
  DOS_HTTP_FLOOD: '#99362E',
  BOTNET: '#5C4F6E',
  BOTNET_HTTP_C2: '#5C4F6E',
  BOTNET_IRC_C2: '#5C4F6E',
  BRUTE_FORCE: '#8F6522',
  BRUTE_FORCE_SSH: '#8F6522',
  BRUTE_FORCE_FTP: '#8F6522',
  INFILTRATION: '#99362E',
  PORTSCAN: '#355670',
  PORTSCAN_SYN: '#355670',
  EXPLOITS: '#99362E',
  FUZZERS: '#5C4F6E',
  GENERIC: '#4A473F',
  BACKDOOR: '#99362E',
  SHELLCODE: '#99362E',
  WEB_BRUTE_FORCE: '#8F6522',
  WEB_SQL_INJECTION: '#8F6522',
  WEB_XSS: '#8F6522',
  WORM: '#5C4F6E',
  APACHE2: '#5C4F6E',
}
