import type { WeeklyHour } from "@/lib/availability";
import { minuteToHHMM, WEEK_ORDER, WEEKDAYS } from "@/lib/time";

export function HoursTable({ weekly }: { weekly: WeeklyHour[] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {WEEK_ORDER.map((wd) => {
        const ranges = weekly.filter((h) => h.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
        return (
          <div key={wd} className="flex justify-between gap-4">
            <dt className="text-ink-soft">{WEEKDAYS[wd]}</dt>
            <dd className={ranges.length ? "text-right font-medium text-ink" : "text-muted"}>
              {ranges.length ? ranges.map((r) => `${minuteToHHMM(r.startMinute)}–${minuteToHHMM(r.endMinute)}`).join(", ") : "Cerrado"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
