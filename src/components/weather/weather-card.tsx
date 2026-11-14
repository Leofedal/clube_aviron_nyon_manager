import {
  ArrowUp,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  OctagonAlert,
  Sun,
  Sunrise,
  Sunset,
  TriangleAlert,
  Wind,
  CircleCheck,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CLUB } from "@/lib/club";
import { formatDuration, formatTime } from "@/lib/time";
import { compassPoint, localWindName, weatherIcon, weatherLabel, windLevel, type WeatherIcon } from "@/lib/wind";
import type { SunData, WeatherData } from "@/lib/weather";

const ICONS: Record<WeatherIcon, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const LEVEL_STYLE = {
  calm: { cls: "bg-success/12 text-success", icon: CircleCheck },
  moderate: { cls: "bg-warning/15 text-[color-mix(in_oklch,var(--warning)_60%,black)] dark:text-warning", icon: Wind },
  strong: { cls: "bg-warning/25 text-[color-mix(in_oklch,var(--warning)_50%,black)] dark:text-warning", icon: TriangleAlert },
  danger: { cls: "bg-destructive/12 text-destructive", icon: OctagonAlert },
} as const;

/** Flèche orientée vers où souffle le vent (la direction météo indique d'où il vient). */
function WindArrow({ direction, className }: { direction: number; className?: string }) {
  return (
    <ArrowUp
      className={className}
      style={{ transform: `rotate(${(direction + 180) % 360}deg)` }}
      aria-hidden
    />
  );
}

export function WeatherCard({
  weather,
  sun,
  now = new Date(),
  simulation,
}: {
  weather: WeatherData | null;
  sun: SunData | null;
  now?: Date;
  /** Libellé affiché quand le mode démonstration simule l'heure ou le vent */
  simulation?: string | null;
}) {
  const w = weather?.current;
  const level = w ? windLevel(w.speed, w.gusts) : null;
  const local = w ? localWindName(w.direction, w.speed) : null;
  const Icon = w ? ICONS[weatherIcon(w.weatherCode)] : null;
  const LevelIcon = level ? LEVEL_STYLE[level.level].icon : null;

  const minutesToSunset = sun ? Math.round((sun.sunset.getTime() - now.getTime()) / 60000) : null;
  const afterSunset = minutesToSunset != null && minutesToSunset <= 0;
  const beforeSunrise = sun ? now.getTime() < sun.sunrise.getTime() : false;

  return (
    <section aria-labelledby="weather-title" className="bg-card rounded-xl border">
      {simulation && (
        <div className="bg-live/12 text-live flex items-center gap-2 rounded-t-xl px-4 py-1.5 text-xs font-medium">
          <FlaskConical className="size-3.5 shrink-0" /> {simulation} — données fictives pour la démonstration
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 id="weather-title" className="flex items-center gap-2 text-sm font-semibold">
          <Wind className="text-muted-foreground size-4" /> Conditions sur le lac · {CLUB.location.label}
        </h2>
        {w && (
          <span className="text-muted-foreground text-xs">
            {Icon && <Icon className="mr-1 inline size-3.5 align-[-2px]" />}
            {weatherLabel(w.weatherCode)} · {w.temperature} °C
          </span>
        )}
      </div>

      {level && LevelIcon && (
        <div className={cn("mx-4 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm", LEVEL_STYLE[level.level].cls)}>
          <LevelIcon className="size-4 shrink-0" />
          <span>
            <strong>{level.label}</strong> — {level.advice}
          </span>
        </div>
      )}

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)] md:gap-6">
        {/* Vent actuel — information prioritaire */}
        {w && level ? (
          <div className="flex items-start gap-4">
            <div className="bg-secondary flex size-16 shrink-0 items-center justify-center rounded-full" title={`Vent venant du ${compassPoint(w.direction)} (${Math.round(w.direction)}°)`}>
              <WindArrow direction={w.direction} className="text-foreground size-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight tabular">{w.speed}</span>
                <span className="text-muted-foreground text-sm">km/h</span>
              </div>
              <div className="text-sm">
                Rafales <strong className="tabular">{w.gusts} km/h</strong>
              </div>
              <div className="text-muted-foreground text-sm">
                {local ? <strong className="text-foreground">{local}</strong> : "Vent"} · du {compassPoint(w.direction)} (
                {Math.round(w.direction)}°)
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Wind className="size-5" /> Météo momentanément indisponible. Consultez MétéoSuisse avant de sortir.
          </div>
        )}

        {/* Prochaines heures */}
        {weather && weather.nextHours.length > 0 ? (
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">Vent les prochaines heures (km/h, rafales)</p>
            <ol className="grid grid-cols-6 gap-1">
              {weather.nextHours.map((h) => {
                const lv = windLevel(h.speed, h.gusts).level;
                return (
                  <li
                    key={h.time.toISOString()}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-center",
                      lv === "calm" ? "bg-muted/50" : LEVEL_STYLE[lv].cls,
                    )}
                    title={`${formatTime(h.time)} : ${h.speed} km/h, rafales ${h.gusts} km/h, du ${compassPoint(h.direction)}`}
                  >
                    <span className="text-muted-foreground text-[11px] tabular">{formatTime(h.time).slice(0, 2)}h</span>
                    <WindArrow direction={h.direction} className="size-4" />
                    <span className="text-sm font-semibold tabular">{h.speed}</span>
                    <span className="text-muted-foreground text-[11px] tabular">{h.gusts}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Soleil */}
        {sun && (
          <div className="flex items-start gap-3 md:border-l md:pl-6">
            {afterSunset || beforeSunrise ? (
              <>
                <Sunrise className="text-muted-foreground mt-0.5 size-6 shrink-0" />
                <div>
                  <div className="text-muted-foreground text-xs font-medium">{afterSunset ? "Soleil couché" : "Avant le lever"}</div>
                  <div className="text-lg font-semibold tabular">
                    Lever {formatTime(afterSunset ? (sun.nextSunrise ?? sun.sunrise) : sun.sunrise)}
                  </div>
                  <div className="text-muted-foreground text-xs">Coucher à {formatTime(sun.sunset)}</div>
                </div>
              </>
            ) : (
              <>
                <Sunset className="text-warning mt-0.5 size-6 shrink-0" />
                <div>
                  <div className="text-muted-foreground text-xs font-medium">Coucher du soleil</div>
                  <div className="text-lg font-semibold tabular">{formatTime(sun.sunset)}</div>
                  <div className={cn("text-xs", minutesToSunset! <= 60 ? "text-destructive font-medium" : "text-muted-foreground")}>
                    dans {formatDuration(minutesToSunset!)}
                    {minutesToSunset! <= 60 && " — prévoyez votre retour"}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-muted-foreground border-t px-4 py-2 text-[11px]">
        Indications à titre informatif — la décision de sortir reste celle de l&apos;équipage et des responsables.{" "}
        {w && <>Mise à jour {formatTime(w.time)} · </>}
        Météo :{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Open-Meteo
        </a>{" "}
        (modèles MétéoSuisse inclus) · Soleil : calcul astronomique.
      </p>
    </section>
  );
}
