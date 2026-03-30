export type MenuData = Record<string, Record<string, string>>;

const CACHE_PREFIX = 'menu_cache_';

const getCacheKey = (year: number, week: number) => `${CACHE_PREFIX}${year}_${week}`;

const getCachedData = (year: number, week: number): MenuData | null => {
  const cached = localStorage.getItem(getCacheKey(year, week));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error('Failed to parse cached menu data', e);
      return null;
    }
  }
  return null;
};

const setCachedData = (year: number, week: number, data: MenuData) => {
  try {
    localStorage.setItem(getCacheKey(year, week), JSON.stringify(data));
  } catch (e) {
    console.error('Failed to cache menu data', e);
  }
};

export const fetchMenuData = async (
  year: number, 
  week: number, 
  dateStr: string,
  forceRefresh: boolean = false
): Promise<MenuData> => {
  // 1. Check cache first
  if (!forceRefresh) {
    const cached = getCachedData(year, week);
    if (cached) {
      console.log(`Using cached data for week ${year}-${week}`);
      return cached;
    }
  }

  let latestData: MenuData | null = null;

  try {
    // 2. Try fetching latest.json first
    console.log('Fetching latest.json...');
    const latestResponse = await fetch('https://raw.githubusercontent.com/CUKbab/CUK_Menu/main/latest.json');
    
    if (latestResponse.ok) {
      const data: MenuData = await latestResponse.json();
      latestData = data;
      console.log('Successfully fetched latest.json');
      
      // Check if latest.json contains the requested date
      const hasDate = Object.values(data).some(menuMap => menuMap && menuMap[dateStr]);
      
      if (hasDate) {
        console.log(`latest.json contains data for ${dateStr}. Caching for week ${year}-${week}`);
        setCachedData(year, week, data);
        return data;
      }
      console.log(`latest.json does not contain data for ${dateStr}.`);
    }
  } catch (error) {
    console.warn("latest.json fetch failed:", error);
  }

  try {
    // 3. Try archive
    const archiveUrl = `https://raw.githubusercontent.com/CUKbab/CUK_Menu/main/menus/${year}/${week}/menu.json`;
    console.log(`Fetching archived menu from: ${archiveUrl}`);
    const archiveResponse = await fetch(archiveUrl);
    
    if (archiveResponse.ok) {
      const archiveData: MenuData = await archiveResponse.json();
      console.log(`Successfully fetched archived menu for week ${year}-${week}`);
      setCachedData(year, week, archiveData);
      return archiveData;
    }
  } catch (error) {
    console.warn("Archive fetch failed:", error);
  }

  // Final fallback chain
  if (latestData) {
    console.log('Falling back to latest.json data (even if date missing)');
    return latestData;
  }

  const cached = getCachedData(year, week);
  if (cached) {
    console.log('Falling back to existing cache');
    return cached;
  }

  throw new Error(`Menu data unavailable for ${dateStr} (Week ${year}-${week})`);
};
