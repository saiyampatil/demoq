/** A short, stable fingerprint of a string. The audio summary and the A2 insights both use it to tell whether what a line was written from has moved. */
export const hash = (s: string) => [...s].reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7).toString(36)
