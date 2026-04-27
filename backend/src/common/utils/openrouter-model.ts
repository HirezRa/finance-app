/** Strip accidental OpenRouter site URL prefix from pasted model ids */
export function cleanOpenRouterModelId(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/^https?:\/\/openrouter\.ai\//i, '')
    .replace(/^openrouter\.ai\//i, '')
    .trim();
}
