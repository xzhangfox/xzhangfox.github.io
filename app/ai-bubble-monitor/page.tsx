import Navigation from '@/components/Navigation'
import AiBubbleMonitor from '@/components/AiBubbleMonitor'
import type { LatestData, HistoryData } from '@/components/AiBubbleMonitor'
import latestData from '@/data/ai-bubble/latest.json'
import historyData from '@/data/ai-bubble/history.json'

export const metadata = {
  title: 'AI Bubble Monitor — Xi Zhang',
  description:
    'A daily, rules-based AI bubble risk gauge built on Ray Dalio\'s bubble framework, Robert Shiller\'s valuation research, and Hyman Minsky\'s financial instability hypothesis.',
}

export default function AiBubbleMonitorPage() {
  return (
    <div className="relative bg-bg">
      <Navigation />
      <AiBubbleMonitor latest={latestData as LatestData} history={historyData as HistoryData} />
    </div>
  )
}
