import {
  HeatmapCells,
  HeatmapChart,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  type HeatmapColumn,
} from '@/components/charts/heatmap';
import { cn } from '@/lib/utils';
import { useChartMotion, WT_ENTER_TWEEN } from './motion-defaults';

/** Build Bklit heatmap columns from a dense [row][col] matrix (0–1 values). */
export function matrixToHeatmapColumns(
  _rows: string[],
  _cols: string[],
  values: number[][],
  baseDate = new Date(),
): HeatmapColumn[] {
  const colCount = values[0]?.length ?? _cols.length;
  const rowCount = values.length || _rows.length;

  return Array.from({ length: colCount }, (_, ci) => ({
    bin: ci,
    bins: Array.from({ length: rowCount }, (_, ri) => {
      const count = values[ri]?.[ci] ?? 0;
      const date = new Date(baseDate);
      date.setHours(ci, 0, 0, 0);
      date.setDate(date.getDate() - (rowCount - 1 - ri));
      return { count, bin: ri, date };
    }),
  }));
}

export function WtHeatmap({
  data,
  className,
}: {
  data: HeatmapColumn[];
  className?: string;
}) {
  const { reduced } = useChartMotion();
  const ready = data.length > 0;

  return (
    <div className={cn('h-64 w-full', className)}>
      <HeatmapChart
        data={data}
        status={ready ? 'ready' : 'loading'}
        enterTransition={reduced ? { type: 'tween', duration: 0 } : WT_ENTER_TWEEN}
        className="h-full w-full"
      >
        <HeatmapCells />
        <HeatmapXAxis />
        <HeatmapYAxis />
        <HeatmapTooltip />
      </HeatmapChart>
    </div>
  );
}
