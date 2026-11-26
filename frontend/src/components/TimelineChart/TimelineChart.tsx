import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts'

interface TimelinePoint {
  time: string
  benign: number
  attack: number
}

interface TimelineChartProps {
  data: TimelinePoint[]
  height?: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="panel-elevated px-3 py-2 text-xs font-mono space-y-1">
      <div className="text-text-muted border-b border-border pb-1 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function TimelineChart({ data, height = 200 }: TimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2DDD0" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: '#7D786D', fontSize: 10, fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#D6D1C4' }}
        />
        <YAxis
          tick={{ fill: '#7D786D', fontSize: 10, fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="benign"
          stroke="#355E3B"
          strokeWidth={1.5}
          fill="#355E3B"
          fillOpacity={0.12}
          dot={false}
          name="Benign"
        />
        <Area
          type="monotone"
          dataKey="attack"
          stroke="#99362E"
          strokeWidth={1.5}
          fill="#99362E"
          fillOpacity={0.12}
          dot={false}
          name="Attack"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
