import { useState, useEffect } from 'react';
import './App.css';
import { fetchMenuData, type MenuData } from './api';
import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { type Language, translations } from './i18n';
import Settings from './Settings';

type Tab = 'buon-pranzo' | 'cafe-bona' | 'settings';

function App() {
  const getInitialDate = () => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0) { // Sunday
      today.setDate(today.getDate() + 1);
    } else if (day === 6) { // Saturday
      today.setDate(today.getDate() + 2);
    }
    return today;
  };

  const [activeTab, setActiveTab] = useState<Tab>('buon-pranzo');
  const [currentDate, setCurrentDate] = useState<Date>(getInitialDate());
  const [interactionType, setInteractionType] = useState<'tab' | 'date'>('tab');
  const [menuData, setMenuData] = useState<MenuData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'ko';
  });
  const [user, setUser] = useState<User | null>(null);

  // i18n helper
  const t = (key: keyof typeof translations['en'], params?: Record<string, string>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{{${param}}}`, params[param]);
      });
    }
    return text;
  };

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Helper to get ISO week number
  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return [date.getUTCFullYear(), weekNo];
  };

  const formatDateString = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString(language, { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const dateStr = formatDateString(currentDate);
  const displayDate = formatDisplayDate(currentDate);

  const fetchMenu = async (date: Date, dateString: string, forceRefresh: boolean = false) => {
    const [year, week] = getWeekNumber(date);
    setLoading(true);
    try {
      const data = await fetchMenuData(year, week, dateString, forceRefresh);
      setMenuData(data);
      setError(null);
    } catch (err) {
      setError(t('failed_to_fetch_menu'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'settings') {
      fetchMenu(currentDate, dateStr);
    }
  }, [currentDate, activeTab]);

  const changeDate = (days: number) => {
    setInteractionType('date');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    
    // Skip weekends
    while (newDate.getDay() === 0 || newDate.getDay() === 6) {
      newDate.setDate(newDate.getDate() + (days > 0 ? 1 : -1));
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setInteractionType('date');
    setCurrentDate(getInitialDate());
  };

  const onRefresh = () => {
    setInteractionType('date');
    fetchMenu(currentDate, dateStr, true);
  };

  const handleTabChange = (tab: Tab) => {
    setInteractionType('tab');
    setActiveTab(tab);
  };

  const getCategoriesForTab = (tab: Tab) => {
    if (tab === 'buon-pranzo') {
      return [
        { title: t('breakfast'), keys: ['Morning'] },
        { title: t('lunch'), keys: ['Pranzo-Korean', 'Pranzo-Global-Noodle', 'Pranzo-Plus-Corner'] },
        { title: t('dinner'), keys: ['Pranzo-Dinner'] }
      ];
    }
    return [
      { title: t('bowl_noodle'), keys: ['Bona-Rice-Bowl'] }
    ];
  };

  const renderMenuContent = () => {
    if (loading) return <div className="loading">{t('loading_menus')}</div>;
    if (error) return <div className="error">{error}</div>;
    
    const categoryGroups = getCategoriesForTab(activeTab);
    const flatKeys = categoryGroups.flatMap(g => g.keys);
    const hasData = flatKeys.some(key => menuData[key] && menuData[key][dateStr] && menuData[key][dateStr] !== "No Menu");

    if (!hasData) {
      return (
        <div className="error">
          {t('no_menu_available', { date: displayDate })}
          <br />
          <button className="nav-tab active" style={{ marginTop: '20px' }} onClick={goToToday}>{t('back_to_today')}</button>
        </div>
      );
    }

    const animationClass = interactionType === 'tab' ? 'animate-slide-up' : 'animate-fade';

    return (
      <div className="menu-list" key={`${activeTab}-${dateStr}`}>
        {categoryGroups.map((group, index) => {
          const groupHasData = group.keys.some(key => menuData[key]?.[dateStr] && menuData[key][dateStr] !== "No Menu");
          if (!groupHasData) return null;

          const staggerClass = interactionType === 'tab' ? `stagger-${index + 1}` : '';

          return (
            <div key={group.title} className={`menu-group ${animationClass} ${staggerClass}`}>
              <h2 className="menu-group-title">{group.title}</h2>
              {group.keys.map(key => {
                const menuText = menuData[key]?.[dateStr];
                if (!menuText || menuText === "No Menu") return null;

                const items = menuText.split('\n').filter(line => line.trim() !== '');
                
                const keyMap: Record<string, keyof typeof translations['en']> = {
                  'Morning': 'category_1000_won_morning',
                  'Pranzo-Korean': 'category_korean_cuisine',
                  'Pranzo-Global-Noodle': 'category_global_noodle',
                  'Pranzo-Plus-Corner': 'category_plus_corner',
                  'Pranzo-Dinner': 'category_dinner',
                  'Bona-Rice-Bowl': 'category_rice_bowl'
                };
                
                const categoryName = keyMap[key] ? t(keyMap[key]) : key.replace('Pranzo-', '').replace('Bona-', '').replace(/-/g, ' ');

                return (
                  <div key={key} className="menu-card">
                    {group.keys.length > 1 && <h3 className="menu-category-title">{categoryName}</h3>}
                    <div className="menu-items">
                      {items.map((item, index) => (
                        <div key={index} className="menu-item">
                          <span className="menu-item-bullet">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'buon-pranzo' ? 'active' : ''}`}
            onClick={() => handleTabChange('buon-pranzo')}
          >
            {t('screen_buon_pranzo')}
          </button>
          <button 
            className={`nav-tab ${activeTab === 'cafe-bona' ? 'active' : ''}`}
            onClick={() => handleTabChange('cafe-bona')}
          >
            {t('screen_cafe_bona')}
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            {t('screen_settings')}
          </button>
        </div>
      </nav>

      {activeTab !== 'settings' ? (
        <>
          <div className="header-controls">
            <div className="date-selector">
              <button className="date-btn" onClick={() => changeDate(-1)} aria-label="Previous Day">◀</button>
              <div className="current-date" onClick={goToToday} style={{ cursor: 'pointer' }}>
                {displayDate}
              </div>
              <button className="date-btn" onClick={() => changeDate(1)} aria-label="Next Day">▶</button>
            </div>
            <button className="refresh-btn" onClick={onRefresh} aria-label="Refresh Menu" title={t('refresh')}>
              ↻
            </button>
          </div>

          <main>
            {renderMenuContent()}
          </main>
        </>
      ) : (
        <Settings 
          language={language} 
          setLanguage={setLanguage} 
          user={user} 
        />
      )}
    </div>
  );
}

export default App;
