import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Activity, Cpu, Shield } from 'lucide-react'
import { clsx } from 'clsx'
import type { PredictionResponse } from '@/types'
import ThreatGauge from '@/components/ThreatGauge/ThreatGauge'
import { ATTACK_COLORS } from '@/config/api'

interface PredictionCardProps {
  prediction: PredictionResponse
  onClick?: () => void
  compact?: boolean
}

export default function PredictionCard({ prediction, onClick, compact = false }: PredictionCardProps) {
  const isBenign = prediction.predicted_attack === 'BENIGN'
  const attackColor = ATTACK_COLORS[prediction.predicted_attack] || '#355670'

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onClick}
        className={clsx(
          "panel px-4 py-3 flex items-center gap-4 cursor-pointer",
          "hover:bg-bg-elevated hover:border-border-strong transition-colors duration-150"
        )}
        style={{ borderLeftWidth: '3px', borderLeftColor: attackColor }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-semibold tracking-tight" style={{ color: attackColor }}>
            {prediction.predicted_attack}
          </div>
          <div className="font-mono text-xs text-text-muted tabular-nums">
            {(prediction.confidence * 100).toFixed(1)}% confidence
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-sm font-semibold text-text-primary tabular-nums">
            {prediction.threat_score.toFixed(0)}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">score</div>
        </div>
        <span className={clsx(
          'flex-shrink-0',
          prediction.severity === 'low' && 'badge-low',
          prediction.severity === 'medium' && 'badge-medium',
          prediction.severity === 'high' && 'badge-high',
          prediction.severity === 'critical' && 'badge-critical',
        )}>
          {prediction.severity}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={clsx(
        "panel-primary p-6 transition-colors duration-150",
        onClick && "cursor-pointer hover:bg-bg-elevated"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {isBenign
              ? <CheckCircle className="w-4 h-4 text-semantic-normal" />
              : <AlertTriangle className="w-4 h-4" style={{ color: attackColor }} />
            }
            <span className="font-mono text-[11px] text-text-muted uppercase tracking-widest">
              {isBenign ? 'Traffic Classification' : 'Threat Detected'}
            </span>
          </div>
          <h3
            className="font-serif text-2xl font-semibold tracking-tight"
            style={{ color: attackColor }}
          >
            {prediction.predicted_attack}
          </h3>
        </div>
        <ThreatGauge score={prediction.threat_score} severity={prediction.severity} size="sm" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-bg-base rounded-[2px] p-3 border border-border">
          <div className="label-text mb-1 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Confidence
          </div>
          <div className="font-mono text-lg font-semibold text-text-primary tabular-nums">
            {(prediction.confidence * 100).toFixed(1)}%
          </div>
          <div className="mt-1.5 h-1.5 bg-bg-elevated border border-border overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prediction.confidence * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full"
              style={{ backgroundColor: attackColor }}
            />
          </div>
        </div>
        <div className="bg-bg-base rounded-[2px] p-3 border border-border">
          <div className="label-text mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Anomaly Score
          </div>
          <div className={clsx(
            "font-mono text-lg font-semibold tabular-nums",
            prediction.is_anomaly ? "text-semantic-crit" : "text-semantic-normal"
          )}>
            {(prediction.anomaly_score * 100).toFixed(1)}%
          </div>
          <div className="mt-1.5 h-1.5 bg-bg-elevated border border-border overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prediction.anomaly_score * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              className="h-full"
              style={{ backgroundColor: prediction.is_anomaly ? '#99362E' : '#355E3B' }}
            />
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="flex items-center gap-3 flex-wrap">
        {prediction.is_anomaly && (
          <span className="flex items-center gap-1.5 text-xs font-mono text-semantic-crit bg-semantic-crit-fill px-2 py-1 rounded-[2px] border border-semantic-crit-border">
            <Activity className="w-3 h-3" /> Anomaly detected
          </span>
        )}
        {prediction.signature_matched && (
          <span className="flex items-center gap-1.5 text-xs font-mono text-semantic-warn bg-semantic-warn-fill px-2 py-1 rounded-[2px] border border-semantic-warn-border">
            <Shield className="w-3 h-3" /> Signature match
          </span>
        )}
        {prediction.signature_rule && (
          <span className="text-xs font-mono text-text-muted">{prediction.signature_rule}</span>
        )}
      </div>
    </motion.div>
  )
}
