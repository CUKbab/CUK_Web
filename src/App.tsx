import { useState, useEffect } from 'react';
import './App.css';
import { fetchMenuData, type MenuData } from './api';
import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { type Language, translations } from './i18n';
import Settings from './Settings';
import { getInitialDate, getWeekNumber, formatDateString } from './utils';
import { type Tab, CATEGORY_MAP } from './constants';
import { ShareIcon } from './Icons';

function App() {
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const dateStr = formatDateString(currentDate);
  const displayDate = currentDate.toLocaleDateString(language, { 
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
  });

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

  const handleShare = (categoryName: string, items: string[]) => {
    const screenName = t(activeTab === 'buon-pranzo' ? 'screen_buon_pranzo' : 'screen_cafe_bona');
    const text = `${displayDate}\n${screenName} - ${categoryName}\n\n${items.map(item => `• ${item}`).join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(categoryName);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getCategoriesForTab = (tab: Tab) => {
    if (tab === 'buon-pranzo') {
      return [
        { title: t('breakfast'), keys: ['Morning'] },
        { title: t('lunch'), keys: ['Pranzo-Korean', 'Pranzo-Global-Noodle', 'Pranzo-Plus-Corner', 'Lunch'] },
        { title: t('dinner'), keys: ['Pranzo-Dinner', 'Dinner'] }
      ];
    }
    return [{ title: t('bowl_noodle'), keys: ['Bona-Rice-Bowl'] }];
  };

  const renderMenuContent = () => {
    if (loading) return <div className="loading">{t('loading_menus')}</div>;
    if (error) return <div className="error">{error}</div>;
    
    const categoryGroups = getCategoriesForTab(activeTab);
    const hasData = categoryGroups.some(g => g.keys.some(k => menuData[k]?.[dateStr] && menuData[k][dateStr] !== "No Menu"));

    if (!hasData) {
      return (
        <div className="error">
          {t('no_menu_available', { date: displayDate })}
          <br />
          <button className="nav-tab active" style={{ marginTop: '20px' }} onClick={goToToday}>{t('back_to_today')}</button>
        </div>
      );
    }

    return (
      <div className="menu-list" key={`${activeTab}-${dateStr}`}>
        {categoryGroups.map((group, index) => {
          const groupHasData = group.keys.some(key => menuData[key]?.[dateStr] && menuData[key][dateStr] !== "No Menu");
          if (!groupHasData) return null;

          const animationClass = interactionType === 'tab' ? `animate-slide-up stagger-${index + 1}` : 'animate-fade';

          return (
            <div key={group.title} className={`menu-group ${animationClass}`}>
              <h2 className="menu-group-title">{group.title}</h2>
              {group.keys.map(key => {
                const menuText = menuData[key]?.[dateStr];
                if (!menuText || menuText === "No Menu") return null;

                const items = menuText.split('\n').filter(line => line.trim() !== '');
                const categoryName = CATEGORY_MAP[key] ? t(CATEGORY_MAP[key] as any) : key.replace(/Pranzo-|Bona-/g, '').replace(/-/g, ' ');

                return (
                  <div key={key} className="menu-card">
                    {group.keys.length > 1 && (
                      <div className="menu-card-header">
                        <h3 className="menu-category-title">{categoryName}</h3>
                      </div>
                    )}
                    <button 
                      className={`share-card-btn ${copiedId === categoryName ? 'copied' : ''}`}
                      onClick={() => handleShare(categoryName, items)}
                      title="Copy to clipboard"
                    >
                      {copiedId === categoryName ? '✓' : <ShareIcon width={18} height={18} />}
                    </button>
                    <div className="menu-items">
                      {items.map((item, idx) => (
                        <div key={idx} className="menu-item">
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
          {(['buon-pranzo', 'cafe-bona', 'settings'] as Tab[]).map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => handleTabChange(tab)}>
              {t(`screen_${tab.replace('-', '_')}` as any)}
            </button>
          ))}
        </div>
      </nav>

      {activeTab !== 'settings' ? (
        <>
          <div className="header-controls">
            <div className="date-selector">
              <button className="date-btn" onClick={() => changeDate(-1)}>◀</button>
              <div className="current-date" onClick={goToToday} style={{ cursor: 'pointer' }}>{displayDate}</div>
              <button className="date-btn" onClick={() => changeDate(1)}>▶</button>
            </div>
            <button className="refresh-btn" onClick={onRefresh} title={t('refresh')}>↻</button>
          </div>
          <main>{renderMenuContent()}</main>
        </>
      ) : (
        <Settings language={language} setLanguage={setLanguage} user={user} />
      )}
    </div>
  );
}

export default App;
