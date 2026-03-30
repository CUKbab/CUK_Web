export type Tab = 'buon-pranzo' | 'cafe-bona' | 'settings';

export interface CategoryGroup {
  title: string;
  keys: string[];
}

export const REPORTER_URL = 'https://github-reporter.cukbab.workers.dev/';

export const CATEGORY_MAP: Record<string, string> = {
  'Morning': 'category_1000_won_morning',
  'Pranzo-Korean': 'category_korean_cuisine',
  'Pranzo-Global-Noodle': 'category_global_noodle',
  'Pranzo-Plus-Corner': 'category_plus_corner',
  'Pranzo-Dinner': 'category_dinner',
  'Bona-Rice-Bowl': 'category_rice_bowl'
};
