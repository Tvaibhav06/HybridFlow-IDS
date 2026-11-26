import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { Zap, Play, Square, RotateCcw, Activity } from 'lucide-react'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import TimelineChart from '@/components/TimelineChart/TimelineChart'
import type { PredictionResponse, TrafficFeatures } from '@/types'
import { ATTACK_COLORS } from '@/config/api'
import { format } from 'date-fns'

const ATTACK_TEMPLATES: Array<{
  type: string
  label: string
  description: string
  color: string
  fill: string
  border: string
  icon: string
  features: TrafficFeatures
}> = [
  {
    type: 'ddos',
    label: 'DDoS Burst',
    description: 'Volumetric flood with massive packet rate',
    color: '#99362E',
    fill: '#F8ECEB',
    border: '#DDB5B1',
    icon: 'SIM-01',
    features: {
      flow_duration: 1293792.0, flow_iat_mean: 143754.6667, flow_iat_std: 430865.8067,
      packet_count: 10.0, fwd_packets: 3.0, bwd_packets: 7.0, fwd_bwd_ratio: 0.4286,
      byte_count: 11633.0, fwd_bytes: 26.0, bwd_bytes: 11607.0,
      flow_bytes_per_sec: 8991.3989, flow_packets_per_sec: 7.7292,
      avg_packet_size: 1057.5454, fwd_packet_size_mean: 8.6667, bwd_packet_size_mean: 1658.1428,
      syn_flag_count: 0.0, ack_flag_count: 0.0, rst_flag_count: 0.0,
      fin_flag_count: 0.0, psh_flag_count: 1.0,
      payload_length: 26.0, payload_entropy: 0.47,
      fwd_header_length: 72.0, bwd_header_length: 152.0,
    },
  },
  {
    type: 'portscan',
    label: 'Port Scan',
    description: 'Systematic probing of network ports',
    color: '#355670',
    fill: '#EBF0F4',
    border: '#B5C7D6',
    icon: 'SIM-02',
    features: {
      flow_duration: 671.0, flow_iat_mean: 335.5, flow_iat_std: 296.2777,
      packet_count: 3.0, fwd_packets: 2.0, bwd_packets: 1.0, fwd_bwd_ratio: 2.0,
      byte_count: 10.0, fwd_bytes: 8.0, bwd_bytes: 2.0,
      flow_bytes_per_sec: 14903.1297, flow_packets_per_sec: 4470.9389,
      avg_packet_size: 3.0, fwd_packet_size_mean: 4.0, bwd_packet_size_mean: 2.0,
      syn_flag_count: 0.0, ack_flag_count: 0.0, rst_flag_count: 0.0,
      fin_flag_count: 0.0, psh_flag_count: 1.0,
      payload_length: 8.0, payload_entropy: 0.3,
      fwd_header_length: 44.0, bwd_header_length: 24.0,
    },
  },
  {
    type: 'bruteforce',
    label: 'Brute Force',
    description: 'Repeated authentication attempts',
    color: '#8F6522',
    fill: '#F7F1E3',
    border: '#D9C59E',
    icon: 'SIM-03',
    features: {
      flow_duration: 3302859.0, flow_iat_mean: 300259.9091, flow_iat_std: 977989.9797,
      packet_count: 12.0, fwd_packets: 6.0, bwd_packets: 6.0, fwd_bwd_ratio: 1.0,
      byte_count: 112.0, fwd_bytes: 36.0, bwd_bytes: 76.0,
      flow_bytes_per_sec: 33.91, flow_packets_per_sec: 3.6332,
      avg_packet_size: 8.6154, fwd_packet_size_mean: 6.0, bwd_packet_size_mean: 12.6667,
      syn_flag_count: 0.0, ack_flag_count: 0.0, rst_flag_count: 0.0,
      fin_flag_count: 0.0, psh_flag_count: 1.0,
      payload_length: 36.0, payload_entropy: 0.517,
      fwd_header_length: 200.0, bwd_header_length: 200.0,
    },
  },
  {
    type: 'dos',
    label: 'DoS Attack',
    description: 'Single-source denial of service',
    color: '#99362E',
    fill: '#F8ECEB',
    border: '#DDB5B1',
    icon: 'SIM-04',
    features: {
      flow_duration: 1878.0, flow_iat_mean: 234.75, flow_iat_std: 229.1299,
      packet_count: 9.0, fwd_packets: 3.0, bwd_packets: 6.0, fwd_bwd_ratio: 0.5,
      byte_count: 11977.0, fwd_bytes: 382.0, bwd_bytes: 11595.0,
      flow_bytes_per_sec: 6377529.286, flow_packets_per_sec: 4792.3323,
      avg_packet_size: 1197.7, fwd_packet_size_mean: 127.3333, bwd_packet_size_mean: 1932.5,
      syn_flag_count: 0.0, ack_flag_count: 0.0, rst_flag_count: 0.0,
      fin_flag_count: 0.0, psh_flag_count: 1.0,
      payload_length: 382.0, payload_entropy: 0.8577,
      fwd_header_length: 104.0, bwd_header_length: 200.0,
    },
  },
  {
    type: 'botnet',
    label: 'Botnet C2',
    description: 'Command and control communication',
    color: '#5C4F6E',
    fill: '#F1EEF5',
    border: '#C9C0D6',
    icon: 'SIM-05',
    features: {
      flow_duration: 134812.0, flow_iat_mean: 22468.6667, flow_iat_std: 53230.9112,
      packet_count: 7.0, fwd_packets: 4.0, bwd_packets: 3.0, fwd_bwd_ratio: 1.3333,
      byte_count: 340.0, fwd_bytes: 206.0, bwd_bytes: 134.0,
      flow_bytes_per_sec: 2522.0307, flow_packets_per_sec: 51.9242,
      avg_packet_size: 42.5, fwd_packet_size_mean: 51.5, bwd_packet_size_mean: 44.6667,
      syn_flag_count: 0.0, ack_flag_count: 0.0, rst_flag_count: 0.0,
      fin_flag_count: 0.0, psh_flag_count: 1.0,
      payload_length: 206.0, payload_entropy: 0.7687,
      fwd_header_length: 92.0, bwd_header_length: 72.0,
    },
  },
]

function addJitter(features: TrafficFeatures): TrafficFeatures {
  const result: TrafficFeatures = {}
  Object.entries(features).forEach(([k, v]) => {
    if (typeof v === 'number' && v > 0) {
      const jitter = 0.9 + Math.random() * 0.2
      ;(result as any)[k] = v * jitter
    } else {
      ;(result as any)[k] = v
    }
  })
  return result
}

function genId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export default function AttackSimulator() {
  const [selectedTemplate, setSelectedTemplate] = useState(ATTACK_TEMPLATES[0])
  const [isRunning, setIsRunning] = useState(false)
  const [simResults, setSimResults] = useState<PredictionResponse[]>([])
  const [timelineData, setTimelineData] = useState<Array<{ time: string; benign: number; attack: number }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { addPrediction } = useSettingsStore()

  const { mutate } = useMutation({
    mutationFn: (features: TrafficFeatures) => api.predict(features),
    onSuccess: (data, features) => {
      setSimResults(prev => [data, ...prev].slice(0, 50))
      addPrediction({
        ...data,
        id: genId(),
        timestamp: new Date().toISOString(),
        features,
      })
      setTimelineData(prev => {
        const now = format(new Date(), 'HH:mm:ss')
        const last = [...prev].slice(-19)
        const isBenign = data.predicted_attack === 'BENIGN'
        return [...last, {
          time: now,
          benign: isBenign ? 1 : 0,
          attack: isBenign ? 0 : 1,
        }]
      })
    },
  })

  const startSimulation = () => {
    setIsRunning(true)
    setSimResults([])
    setTimelineData([])
    mutate(addJitter(selectedTemplate.features))
    intervalRef.current = setInterval(() => {
      mutate(addJitter(selectedTemplate.features))
    }, 1500)
  }

  const stopSimulation = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const reset = () => {
    stopSimulation()
    setSimResults([])
    setTimelineData([])
  }

  const attackCount = simResults.filter(r => r.predicted_attack !== 'BENIGN').length
  const avgScore = simResults.length
    ? simResults.reduce((s, r) => s + r.threat_score, 0) / simResults.length
    : 0

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="font-serif text-2xl font-semibold text-text-primary tracking-tight">Attack Simulator</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Simulate cyber attacks and observe real-time detection
        </p>
      </div>

      {/* Template selection */}
      <div className="grid grid-cols-5 gap-3">
        {ATTACK_TEMPLATES.map((template) => {
          const isSelected = selectedTemplate.type === template.type
          return (
            <button
              key={template.type}
              onClick={() => { setSelectedTemplate(template); if (isRunning) stopSimulation() }}
              className={`panel p-4 text-left transition-colors duration-150 ${
                isSelected ? 'border-border-strong bg-bg-elevated' : 'hover:bg-bg-elevated'
              }`}
              style={{
                borderLeftWidth: isSelected ? '3px' : undefined,
                borderLeftColor: isSelected ? template.color : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
                  {template.icon}
                </span>
                <div className="w-1.5 h-1.5" style={{ backgroundColor: template.color }} />
              </div>
              <div className="font-mono text-xs font-semibold" style={{ color: template.color }}>
                {template.label}
              </div>
              <div className="font-mono text-xs text-text-muted mt-1 leading-relaxed">
                {template.description}
              </div>
            </button>
          )
        })}
      </div>

      {/* Controls */}
      <div className="panel p-4 flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] border"
          style={{
            borderColor: selectedTemplate.border,
            color: selectedTemplate.color,
            backgroundColor: selectedTemplate.fill,
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider">{selectedTemplate.label}</span>
        </div>
        <div className="flex-1" />
        <button onClick={reset} className="btn-ghost p-2" disabled={isRunning} title="Reset simulation">
          <RotateCcw className="w-4 h-4" />
        </button>
        {isRunning ? (
          <button
            onClick={stopSimulation}
            className="bg-semantic-crit-fill text-semantic-crit border border-semantic-crit font-mono font-semibold px-4 py-2 rounded-[2px] text-xs uppercase tracking-wider hover:bg-semantic-crit hover:text-bg-surface transition-colors flex items-center gap-2"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button onClick={startSimulation} className="btn-primary flex items-center gap-2">
            <Play className="w-3.5 h-3.5" /> Start Simulation
          </button>
        )}
      </div>

      {/* Live stats */}
      {simResults.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Total Flows</div>
            <div className="font-mono text-3xl font-semibold text-text-primary tabular-nums">{simResults.length}</div>
          </div>
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Attacks Detected</div>
            <div className="font-mono text-3xl font-semibold text-semantic-crit tabular-nums">{attackCount}</div>
            <div className="font-mono text-xs text-text-muted mt-1 tabular-nums">
              {((attackCount / simResults.length) * 100).toFixed(0)}% detection rate
            </div>
          </div>
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Avg Threat Score</div>
            <div className="font-mono text-3xl font-semibold tabular-nums" style={{ color: selectedTemplate.color }}>
              {avgScore.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Timeline */}
        {timelineData.length > 0 && (
          <div className="panel p-4">
            <div className="label-text mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Live Detection Timeline
            </div>
            <TimelineChart data={timelineData} height={180} />
          </div>
        )}

        {/* Live feed */}
        <div className="panel p-4">
          <div className="label-text mb-3 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 ${isRunning ? 'bg-semantic-crit' : 'bg-text-muted'}`} />
            {isRunning ? 'Live Detection Feed' : 'Detection Results'}
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            <AnimatePresence>
              {simResults.slice(0, 8).map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-[2px] bg-bg-base border border-border"
                >
                  <div
                    className="w-1.5 h-1.5 flex-shrink-0"
                    style={{ backgroundColor: ATTACK_COLORS[r.predicted_attack] || '#4A473F' }}
                  />
                  <span
                    className="font-mono text-xs font-semibold flex-1"
                    style={{ color: ATTACK_COLORS[r.predicted_attack] || '#4A473F' }}
                  >
                    {r.predicted_attack}
                  </span>
                  <span className="font-mono text-xs text-text-muted tabular-nums">
                    {r.threat_score.toFixed(0)}
                  </span>
                  <span className={`text-xs font-mono ${
                    r.severity === 'critical' ? 'badge-critical' :
                    r.severity === 'high' ? 'badge-high' :
                    r.severity === 'medium' ? 'badge-medium' :
                    'badge-low'
                  }`}>
                    {r.severity}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {simResults.length === 0 && (
              <div className="text-center py-8 text-text-muted font-mono text-xs">
                Click Start Simulation to begin
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
