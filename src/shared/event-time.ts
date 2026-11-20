export function getEventStart(event: {
  strTimestamp?: string | null;
  strTime?: string | null;
  dateEvent: string;
}) {
  if (event.strTimestamp) {
    // TheSportsDB timestamps are UTC but do not include a timezone suffix.
    const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.strTimestamp);
    const timestamp = new Date(`${event.strTimestamp}${hasTimeZone ? "" : "Z"}`);
    if (!Number.isNaN(timestamp.getTime())) return timestamp;
  }

  const time = (event.strTime || "00:00:00").replace(/Z$/, "");
  return new Date(`${event.dateEvent}T${time}Z`);
}
