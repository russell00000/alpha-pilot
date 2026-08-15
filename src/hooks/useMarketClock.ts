import { useEffect, useState } from "react";

const ET_ZONE = "America/New_York";

const etParts = (date: Date) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
};

/** Live ET clock plus regular-session open/closed state, ticking every second. */
export const useMarketClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { hour, minute, weekday } = etParts(now);
  const minutes = hour * 60 + minute;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const isOpen = isWeekday && minutes >= 9 * 60 + 30 && minutes < 16 * 60;

  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return { now, clock, isOpen };
};

export default useMarketClock;
