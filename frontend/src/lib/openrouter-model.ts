export function cleanOpenRouterModelId(input: string): string {
  if (!input) return '';
  return input
    .replace(/^https?:\/\/openrouter\.ai\//i, '')
    .replace(/^openrouter\.ai\//i, '')
    .trim();
}
