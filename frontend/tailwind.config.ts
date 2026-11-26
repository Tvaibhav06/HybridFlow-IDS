import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#F6F4EE',
          primary: '#F6F4EE',
          surface: '#FAF9F5',
          secondary: '#FAF9F5',
          card: '#FAF9F5',
          elevated: '#EFECE3',
          hover: '#EFECE3',
          border: '#D6D1C4',
        },
        accent: {
          green: '#355E3B',
          'green-dim': '#2A4B2F',
          cyan: '#355670',
          amber: '#8F6522',
          red: '#99362E',
          blue: '#355670',
          purple: '#5C4F6E',
        },
        semantic: {
          normal: {
            DEFAULT: '#355E3B',
            fill: '#EBF2EC',
            border: '#B7CBB9',
          },
          warn: {
            DEFAULT: '#8F6522',
            fill: '#F7F1E3',
            border: '#D9C59E',
          },
          crit: {
            DEFAULT: '#99362E',
            fill: '#F8ECEB',
            border: '#DDB5B1',
          },
          info: {
            DEFAULT: '#355670',
            fill: '#EBF0F4',
            border: '#B5C7D6',
          },
          neutral: {
            DEFAULT: '#5C4F6E',
            fill: '#F1EEF5',
            border: '#C9C0D6',
          },
        },
        border: {
          DEFAULT: '#D6D1C4',
          bright: '#262420',
          strong: '#262420',
          grid: '#E2DDD0',
        },
        text: {
          primary: '#1C1B18',
          secondary: '#4A473F',
          muted: '#7D786D',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['IBM Plex Serif', 'Source Serif 4', 'Georgia', 'serif'],
        display: ['IBM Plex Serif', 'Source Serif 4', 'Georgia', 'serif'],
        body: ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
