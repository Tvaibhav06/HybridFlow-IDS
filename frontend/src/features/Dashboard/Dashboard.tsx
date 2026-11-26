import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, TrendingUp, Zap, Eye, Shield } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import TimelineChart from '@/components/TimelineChart/TimelineChart'
import PredictionCard from '@/components/PredictionCard/PredictionCard'
import { ATTACK_COLORS } from '@/config/api'
import { clsx } from 'clsx'
import { format, subMinutes } from 'date-fns'

function generateTimelineData(predictions: any[]) {
  const now = new Date()
  return Array.from({ length: 20 }, (_, i) => {
    const time = subMinutes(now, 19 - i)
    const windowPreds = predictions.filter(p => {
      const pTime = new Date(p.timestamp)
      return Math.abs(pTime.getTime() - time.getTime()) < 60000
    })
    return {
      time: format(time, 'HH:mm'),
      benign: windowPreds.filter(p => p.predicted_attack === 'BENIGN').length,
      attack: windowPreds.filter(p => p.predicted_attack !== 'BENIGN').length,
    }
  })
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="panel p-5"
  >
    <div className="flex items-start justify-between">
      <div>
        <div className="label-text mb-2">{label}</div>
        <div className="metric-value">{value}</div>
        {sub && <div className="font-mono text-xs text-text-muted mt-1 tabular-nums">{sub}</div>}
      </div>
      <div className="w-8 h-8 rounded-[2px] border border-border bg-bg-base flex items-center justify-center">
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
  </motion.div>
)

export default function Dashboard() {
  const { predictions } = useSettingsStore()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 10_000,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
  })

  const recentPredictions = predictions.slice(0, 8)
  const localAttackCount = predictions.filter((p: any) => p.predicted_attack !== 'BENIGN').length
  const localCriticalCount = predictions.filter((p: any) => p.severity === 'critical').length

  const totalAnalyzed = stats?.total_requests ?? predictions.length
  const attackPredictionsCount = stats
    ? Object.entries(stats.attack_distribution || {})
        .filter(([k]) => k !== 'BENIGN')
        .reduce((sum, [, count]) => sum + (count as number), 0)
    : localAttackCount
  const criticalCount = stats
    ? (stats.severity_counts?.critical ?? 0)
    : localCriticalCount
  const attackRate = totalAnalyzed > 0
    ? ((attackPredictionsCount / totalAnalyzed) * 100).toFixed(1)
    : '0.0'

  const attackDistData = Object.entries(stats?.attack_distribution || {})
    .map(([name, value]) => ({
      name,
      value: value as number,
      color: ATTACK_COLORS[name] || '#7D786D',
    }))
    .sort((a, b) => b.value - a.value)

  const timelineData = generateTimelineData(predictions)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary tracking-tight">
            Security Overview
          </h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Real-time hybrid deep learning intrusion detection monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 border border-border bg-bg-surface rounded-[2px]">
          <div className={clsx(
            "w-1.5 h-1.5",
            health?.status === 'ok' ? "bg-semantic-normal" : "bg-semantic-crit"
          )} />
          <span className="font-mono text-xs text-text-secondary">
            {health?.status === 'ok' ? 'All systems operational' : 'Degraded mode'}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="Total Analyzed"
          value={totalAnalyzed.toLocaleString()}
          sub="All time"
          color="#355670"
        />
        <StatCard
          icon={AlertTriangle}
          label="Threats Detected"
          value={attackPredictionsCount.toLocaleString()}
          sub={`${attackRate}% attack rate`}
          color="#99362E"
        />
        <StatCard
          icon={Zap}
          label="Critical Alerts"
          value={criticalCount.toLocaleString()}
          sub="Requires immediate action"
          color="#99362E"
        />
        <StatCard
          icon={Activity}
          label="Anomaly Rate"
          value={`${((stats?.anomaly_rate ?? 0) * 100).toFixed(1)}%`}
          sub="Autoencoder detection"
          color="#5C4F6E"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="col-span-2 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-text mb-1">Traffic Timeline</div>
              <div className="font-serif text-base font-semibold text-text-primary">
                Benign vs Attack flows
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-text-muted" />
          </div>
          <TimelineChart data={timelineData} height={180} />
        </div>

        {/* Attack distribution */}
        <div className="panel p-5">
          <div className="label-text mb-4">Attack Distribution</div>
          {attackDistData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={attackDistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {attackDistData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#FAF9F5" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
                    contentStyle={{
                      background: '#FAF9F5',
                      border: '1px solid #262420',
                      borderRadius: 2,
                      fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                      fontSize: 11,
                      color: '#1C1B18',
                      boxShadow: 'none',
                    }}
                    itemStyle={{ color: '#1C1B18' }}
                    labelStyle={{ color: '#4A473F' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2 max-h-28 overflow-auto">
                {attackDistData.slice(0, 4).map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="font-mono text-xs text-text-secondary">{d.name}</span>
                    </div>
                    <span className="font-mono text-xs text-text-primary tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-text-muted font-mono text-xs">
              No data yet — run predictions
            </div>
          )}
        </div>
      </div>

      {/* Recent predictions */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="label-text flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Recent Predictions
          </div>
          <span className="font-mono text-xs text-text-muted tabular-nums">
            {recentPredictions.length} of {predictions.length}
          </span>
        </div>
        {recentPredictions.length === 0 ? (
          <div className="text-center py-10 text-text-muted font-mono text-xs">
            No predictions yet — go to{' '}
            <Link to="/predict" className="text-semantic-info underline hover:text-text-primary">Playground</Link>
            {' '}or{' '}
            <Link to="/simulator" className="text-semantic-info underline hover:text-text-primary">Simulator</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPredictions.map((p: any) => (
              <PredictionCard key={p.id} prediction={p} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
