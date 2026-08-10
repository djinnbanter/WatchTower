import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toneColor } from './charts';
import { VITALS, type Tone } from '../fixtures';

function vital(key: string) {
  return VITALS.find((v) => v.key === key);
}

const KEYS = ['tps', 'mspt', 'heap', 'disk'] as const;

/**
 * At-a-glance live instruments — complementary to DeskHero (grade / reboot story).
 * No grade, players, or uptime repeats.
 */
export function OverviewVitals() {
  return (
    <div className="grid grid-cols-1 gap-px bg-border *:bg-card sm:grid-cols-2 xl:grid-cols-4">
      {KEYS.map((key) => {
        const v = vital(key);
        if (!v) return null;
        return (
          <Card key={key} className="@container/card rounded-none ring-0">
            <CardHeader>
              <CardDescription>{v.label}</CardDescription>
              <CardTitle
                className="font-mono text-2xl font-normal tabular-nums @[220px]/card:text-3xl"
                style={{ color: toneColor(v.tone as Tone) }}
              >
                {v.value}
                {v.unit ? (
                  <span className="text-base text-muted-foreground">{v.unit}</span>
                ) : null}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="capitalize">
                  {v.tone === 'default' ? 'steady' : v.tone}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <p className="m-0 text-muted-foreground">{v.hint}</p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
