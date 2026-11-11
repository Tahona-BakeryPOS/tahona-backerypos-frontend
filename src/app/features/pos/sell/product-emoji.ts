import { PosProduct } from '../../../core/api/api.models';

/** Icon by keyword of the name or category, while the catalog has no images. */
const RULES: [RegExp, string][] = [
  [/croissant|hojaldr|milhoja/i, '🥐'],
  [/bono|queso|almoj/i, '🧀'],
  [/franc|baguet|pan /i, '🥖'],
  [/torta|ponqu|pastel|postre/i, '🍰'],
  [/empanad/i, '🥟'],
  [/caf|tinto/i, '☕'],
  [/chocolat/i, '🍫'],
  [/jugo|bebida|gaseosa|agua/i, '🧃'],
  [/galleta/i, '🍪'],
  [/huevo/i, '🥚'],
  [/mantequ/i, '🧈'],
];

export function productEmoji(p: Pick<PosProduct, 'name' | 'category'>): string {
  const text = `${p.name} ${p.category} `;
  return RULES.find(([re]) => re.test(text))?.[1] ?? '🍞';
}
