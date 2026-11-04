'use client'

import { Download, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import type { GraphConfig, GraphLayout } from '@/lib/graph/types'

interface GraphControlsProps {
  config: GraphConfig
  onConfigChange: (config: GraphConfig) => void
  onExportSvg: () => void
  onFitToScreen: () => void
}

const LAYOUTS: { value: GraphLayout; label: string }[] = [
  { value: 'force', label: 'Force' },
  { value: 'tree', label: 'Tree' },
  { value: 'radial', label: 'Radial' },
]

export function GraphControls({
  config,
  onConfigChange,
  onExportSvg,
  onFitToScreen,
}: GraphControlsProps) {
  function update(partial: Partial<GraphConfig>) {
    onConfigChange({ ...config, ...partial })
  }

  return (
    <div className="absolute right-4 top-4 z-10 w-52 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 backdrop-blur-sm">
      <p className="mb-3 text-xs font-medium text-zinc-300">Controls</p>

      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-zinc-500">Layout</Label>
          <div className="mt-1 flex gap-1">
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                onClick={() => update({ layout: l.value })}
                className={`flex-1 rounded px-2 py-1 text-[11px] transition-colors ${
                  config.layout === l.value
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-zinc-500">Show Labels</Label>
          <Switch
            checked={config.showLabels}
            onCheckedChange={(v) => update({ showLabels: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-zinc-500">Show Ownership %</Label>
          <Switch
            checked={config.showPercentages}
            onCheckedChange={(v) => update({ showPercentages: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-zinc-500">Highlight Risk</Label>
          <Switch
            checked={config.highlightRisk}
            onCheckedChange={(v) => update({ highlightRisk: v })}
          />
        </div>

        <div>
          <Label className="text-[11px] text-zinc-500">
            Min Ownership: {config.minOwnershipThreshold}%
          </Label>
          <Slider
            value={[config.minOwnershipThreshold]}
            onValueChange={([v]) => update({ minOwnershipThreshold: v })}
            min={0}
            max={100}
            step={5}
            className="mt-1"
          />
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-[11px]" onClick={onExportSvg}>
            <Download className="mr-1 h-3 w-3" />
            SVG
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-[11px]" onClick={onFitToScreen}>
            <Maximize2 className="mr-1 h-3 w-3" />
            Fit
          </Button>
        </div>
      </div>
    </div>
  )
}
