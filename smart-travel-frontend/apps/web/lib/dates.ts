export function daysBetween(start: string, end: string) {
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000))
  }
  
  export function dayIndexFor(dateStr: string, start: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const s = new Date(start + 'T00:00:00')
    return Math.round((d.getTime() - s.getTime()) / 86400000) + 1
  }
  