import React, { useState } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, deleteUser, type User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { type Language, translations } from './i18n';

interface SettingsProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  user: User | null;
}

const Settings: React.FC<SettingsProps> = ({ language, setLanguage, user }) => {
  const t = (key: keyof typeof translations['en'], params?: Record<string, string>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{{${param}}}`, params[param]);
      });
    }
    return text;
  };

  const [isReporting, setIsReporting] = useState<string | null>(null); // 'feature', 'bug'
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteAccount = async () => {
    if (window.confirm(t('delete_account_confirm'))) {
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (error) {
        alert(t('report_error'));
        console.error(error);
      }
    }
  };

  const handleQuickMenuReport = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const reportData = {
      title: 'Menu Error',
      body: 'Menu Error',
      labels: ['menu-error', 'reported-via-web'],
      userEmail: user?.email || null,
      userId: user?.uid || null
    };

    try {
      console.log('Submitting menu report (no-cors mode):', reportData);
      // 'no-cors' mode sends the request but doesn't allow reading the response.
      // This bypasses the CORS NetworkError since we only care about the report arriving.
      await fetch('https://github-reporter.cukbab.workers.dev/', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(reportData)
      });

      // Independent Firestore logging
      addDoc(collection(db, 'reports'), {
        ...reportData,
        timestamp: Date.now()
      }).catch(e => console.warn("Firestore logging failed:", e));

      console.log('Report sent (opaque response)');
      alert(t('report_success'));
    } catch (error) {
      console.error("Failed to submit report:", error);
      alert(`${t('report_error')} (${error instanceof Error ? error.message : 'Unknown error'})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCustomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setReportStatus(null);
    
    const reportData = {
      title: reportTitle,
      body: reportDesc,
      labels: [isReporting || 'bug'],
      userEmail: user.email,
      userId: user.uid
    };

    try {
      console.log('Submitting custom report (no-cors mode):', reportData);
      await fetch('https://github-reporter.cukbab.workers.dev/', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(reportData)
      });

      addDoc(collection(db, 'reports'), {
        ...reportData,
        timestamp: Date.now()
      }).catch(e => console.warn("Firestore logging failed:", e));

      console.log('Custom report sent (opaque response)');
      setReportStatus({ success: true, message: t('report_success') });
      setReportTitle('');
      setReportDesc('');
      setTimeout(() => {
        setReportStatus(null);
        setIsReporting(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to submit custom report:", error);
      setReportStatus({ 
        success: false, 
        message: `${t('report_error')} (${error instanceof Error ? error.message : 'Network error'})` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Account Section */}
      <section className="settings-section animate-slide-up stagger-1">
        <h2 className="settings-section-title">{t('account_settings')}</h2>
        <div className="settings-card">
          {user ? (
            <div className="user-profile">
              {user.photoURL && <img src={user.photoURL} alt="Profile" className="user-avatar" />}
              <div className="user-info">
                <div className="user-name">{t('logged_in_as', { name: user.displayName || 'User' })}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <div className="account-actions">
                <button className="settings-btn logout-btn" onClick={handleLogout}>{t('logout')}</button>
                <button className="settings-btn delete-btn" onClick={handleDeleteAccount}>{t('delete_account')}</button>
              </div>
            </div>
          ) : (
            <div className="login-prompt">
              <p>{t('login_to_access')}</p>
              <button className="settings-btn login-btn" onClick={handleLogin}>
                <span className="btn-icon">G</span> {t('login_with_google')}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Display Section */}
      <section className="settings-section animate-slide-up stagger-2">
        <h2 className="settings-section-title">{t('display_settings')}</h2>
        <div className="settings-card">
          <div className="settings-item">
            <span>{t('language_selection')}</span>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="settings-select"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="settings-section animate-slide-up stagger-3">
        <h2 className="settings-section-title">{t('feedback_support')}</h2>
        <div className="settings-card feedback-grid">
          <button 
            className="feedback-btn" 
            onClick={handleQuickMenuReport}
            disabled={isSubmitting}
          >
            {isSubmitting ? '...' : t('report_menu_error')}
          </button>
          
          <button 
            className={`feedback-btn ${!user ? 'locked' : ''}`} 
            onClick={() => user && setIsReporting('feature')}
            title={!user ? t('login_to_access') : ''}
          >
            {t('suggest_feature')} {!user && '🔒'}
          </button>
          
          <button 
            className={`feedback-btn ${!user ? 'locked' : ''}`} 
            onClick={() => user && setIsReporting('bug')}
            title={!user ? t('login_to_access') : ''}
          >
            {t('report_bug')} {!user && '🔒'}
          </button>
        </div>
      </section>

      {/* Clients Section */}
      <section className="settings-section animate-slide-up stagger-4">
        <h2 className="settings-section-title">{t('clients_title')}</h2>
        <div className="settings-card clients-grid">
          <div className="client-item android">
            <svg className="client-icon" viewBox="0 0 28.99 31.99">
              <g data-name="Capa 2">
                <g data-name="Capa 1">
                  <path d="M13.54 15.28.12 29.34a3.66 3.66 0 0 0 5.33 2.16l15.1-8.6Z" style={{ fill: '#ea4335' }} />
                  <path d="m27.11 12.89-6.53-3.74-7.35 6.45 7.38 7.28 6.48-3.7a3.54 3.54 0 0 0 1.5-4.79 3.62 3.62 0 0 0-1.5-1.5z" style={{ fill: '#fbbc04' }} />
                  <path d="M.12 2.66a3.57 3.57 0 0 0-.12.92v24.84a3.57 3.57 0 0 0 .12.92L14 15.64Z" style={{ fill: '#4285f4' }} />
                  <path d="m13.64 16 6.94-6.85L5.5.51A3.73 3.73 0 0 0 3.63 0 3.64 3.64 0 0 0 .12 2.65Z" style={{ fill: '#34a853' }} />
                </g>
              </g>
            </svg>
            <div className="client-info">
              <span className="client-name">Android</span>
              <a href="https://play.google.com/store/apps/details?id=com.cukbab" target="_blank" rel="noopener noreferrer" className="client-link">
                {t('download_now')}
              </a>
            </div>
          </div>

          <div className="client-item coming-soon">
            <svg className="client-icon" viewBox="0 0 4875 4875">
              <path fill="#0078d4" d="M0 0h2311v2310H0zm2564 0h2311v2310H2564zM0 2564h2311v2311H0zm2564 0h2311v2311H2564"/>
            </svg>
            <div className="client-info">
              <span className="client-name">Windows</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>

          <div className="client-item coming-soon">
            <svg className="client-icon" viewBox="0 0 842.32007 1000.0001">
              <path fill="#666" d="M824.66636 779.30363c-15.12299 34.93724-33.02368 67.09674-53.7638 96.66374-28.27076 40.3074-51.4182 68.2078-69.25717 83.7012-27.65347 25.4313-57.2822 38.4556-89.00964 39.1963-22.77708 0-50.24539-6.4813-82.21973-19.629-32.07926-13.0861-61.55985-19.5673-88.51583-19.5673-28.27075 0-58.59083 6.4812-91.02193 19.5673-32.48053 13.1477-58.64639 19.9994-78.65196 20.6784-30.42501 1.29623-60.75123-12.0985-91.02193-40.2457-19.32039-16.8514-43.48632-45.7394-72.43607-86.6641-31.060778-43.7024-56.597041-94.37983-76.602609-152.15586C10.740416 658.44309 0 598.01283 0 539.50845c0-67.01648 14.481044-124.8172 43.486336-173.25401C66.28194 327.34823 96.60818 296.6578 134.5638 274.1276c37.95566-22.53016 78.96676-34.01129 123.1321-34.74585 24.16591 0 55.85633 7.47508 95.23784 22.166 39.27042 14.74029 64.48571 22.21538 75.54091 22.21538 8.26518 0 36.27668-8.7405 83.7629-26.16587 44.90607-16.16001 82.80614-22.85118 113.85458-20.21546 84.13326 6.78992 147.34122 39.95559 189.37699 99.70686-75.24463 45.59122-112.46573 109.4473-111.72502 191.36456.67899 63.8067 23.82643 116.90384 69.31888 159.06309 20.61664 19.56727 43.64066 34.69027 69.2571 45.4307-5.55531 16.11062-11.41933 31.54225-17.65372 46.35662zM631.70926 20.0057c0 50.01141-18.27108 96.70693-54.6897 139.92782-43.94932 51.38118-97.10817 81.07162-154.75459 76.38659-.73454-5.99983-1.16045-12.31444-1.16045-18.95003 0-48.01091 20.9006-99.39207 58.01678-141.40314 18.53027-21.27094 42.09746-38.95744 70.67685-53.0663C578.3158 9.00229 605.2903 1.31621 630.65988 0c.74076 6.68575 1.04938 13.37191 1.04938 20.00505z"/>
            </svg>
            <div className="client-info">
              <span className="client-name">macOS</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>

          <div className="client-item coming-soon">
            <svg className="client-icon" viewBox="0 0 216 256">
              <defs>
                <linearGradient id="a_tux"><stop offset="0"/><stop offset="1" stopOpacity=".3"/></linearGradient>
                <linearGradient id="g_tux"><stop offset="0" stopColor="#110800"/><stop offset=".6" stopColor="#a65a00" stopOpacity=".8"/><stop offset="1" stopColor="#ff921e" stopOpacity="0"/></linearGradient>
                <linearGradient id="h_tux"><stop offset="0" stopColor="#7c7c7c"/><stop offset="1" stopColor="#7c7c7c" stopOpacity=".3"/></linearGradient>
                <linearGradient id="i_tux"><stop offset="0" stopColor="#7c7c7c"/><stop offset="1" stopColor="#7c7c7c" stopOpacity=".3"/></linearGradient>
                <linearGradient id="b_tux"><stop offset="0" stopColor="#b98309"/><stop offset="1" stopColor="#382605"/></linearGradient>
                <linearGradient id="c_tux"><stop offset="0" stopColor="#ebc40c"/><stop offset="1" stopColor="#ebc40c" stopOpacity="0"/></linearGradient>
                <linearGradient id="d_tux"><stop offset="0"/><stop offset="1" stopOpacity="0"/></linearGradient>
                <linearGradient id="e_tux"><stop offset="0" stopColor="#3e2a06"/><stop offset="1" stopColor="#ad780a"/></linearGradient>
                <linearGradient id="f_tux"><stop offset="0" stopColor="#f3cd0c"/><stop offset="1" stopColor="#f3cd0c" stopOpacity="0"/></linearGradient>
                <linearGradient id="j_tux"><stop offset="0" stopColor="#fefefc"/><stop offset=".8" stopColor="#fefefc"/><stop offset="1" stopColor="#d4d4d4"/></linearGradient>
                <linearGradient id="k_tux"><stop offset="0" stopColor="#757574" stopOpacity="0"/><stop offset=".3" stopColor="#757574"/><stop offset=".5" stopColor="#757574"/><stop offset="1" stopColor="#757574" stopOpacity="0"/></linearGradient>
                <linearGradient id="n_tux"><stop offset="0" stopColor="#949494" stopOpacity=".4"/><stop offset=".5" stopColor="#949494"/><stop offset="1" stopColor="#949494" stopOpacity=".4"/></linearGradient>
                <linearGradient id="l_tux"><stop offset="0" stopColor="#c8c8c8"/><stop offset="1" stopColor="#797978"/></linearGradient>
                <linearGradient id="o_tux"><stop offset="0" stopColor="#747474"/><stop offset=".1" stopColor="#8c8c8c"/><stop offset=".3" stopColor="#a4a4a4"/><stop offset=".5" stopColor="#d4d4d4"/><stop offset=".6" stopColor="#d4d4d4"/><stop offset="1" stopColor="#7c7c7c"/></linearGradient>
                <linearGradient id="m_tux"><stop offset="0" stopColor="#646464" stopOpacity="0"/><stop offset=".3" stopColor="#646464" stopOpacity=".6"/><stop offset=".5" stopColor="#646464"/><stop offset=".7" stopColor="#646464" stopOpacity=".3"/><stop offset="1" stopColor="#646464" stopOpacity="0"/></linearGradient>
                <linearGradient id="p_tux"><stop offset="0" stopColor="#020204"/><stop offset=".7" stopColor="#020204"/><stop offset="1" stopColor="#5c5c5c"/></linearGradient>
                <linearGradient id="q_tux"><stop offset="0" stopColor="#d2940a"/><stop offset=".8" stopColor="#d89c08"/><stop offset=".9" stopColor="#b67e07"/><stop offset="1" stopColor="#946106"/></linearGradient>
                <linearGradient id="r_tux"><stop offset="0" stopColor="#ad780a"/><stop offset=".1" stopColor="#d89e08"/><stop offset=".3" stopColor="#edb80b"/><stop offset=".4" stopColor="#ebc80d"/><stop offset=".5" stopColor="#f5d838"/><stop offset=".8" stopColor="#f6d811"/><stop offset="1" stopColor="#f5cd31"/></linearGradient>
                <linearGradient id="s_tux"><stop offset="0" stopColor="#3a2903"/><stop offset=".6" stopColor="#735208"/><stop offset="1" stopColor="#ac8c04"/></linearGradient>
                <linearGradient id="t_tux"><stop offset="0" stopColor="#f5ce2d"/><stop offset="1" stopColor="#d79b08"/></linearGradient>
                <linearGradient id="V_tux" xlinkHref="#b_tux" x1="23.2" x2="64.3" y1="193" y2="262" gradientUnits="userSpaceOnUse" />
                <linearGradient id="Z_tux" xlinkHref="#c_tux" x1="64.5" x2="77.4" y1="210.8" y2="235.2" gradientUnits="userSpaceOnUse" />
                <linearGradient id="ab_tux" xlinkHref="#d_tux" x1="146.9" x2="150.2" y1="212" y2="235.7" gradientUnits="userSpaceOnUse" />
                <linearGradient id="ad_tux" xlinkHref="#e_tux" x1="151.5" x2="192.9" y1="253" y2="185.8" gradientUnits="userSpaceOnUse" />
                <linearGradient id="ah_tux" xlinkHref="#f_tux" x1="162.8" x2="161.6" y1="180.7" y2="191.6" gradientUnits="userSpaceOnUse" />
                <linearGradient id="ar_tux" xlinkHref="#i_tux" x1="165.7" x2="168.3" y1="173.6" y2="173.5" gradientUnits="userSpaceOnUse" />
                <linearGradient id="at_tux" xlinkHref="#k_tux" x1="84.3" x2="89.3" y1="46.6" y2="55.6" gradientUnits="userSpaceOnUse" />
                <linearGradient id="ay_tux" xlinkHref="#m_tux" x1="83.6" x2="94.5" y1="32.5" y2="43.6" gradientUnits="userSpaceOnUse" />
                <linearGradient id="aB_tux" xlinkHref="#n_tux" x1="117.9" x2="123.7" y1="47.3" y2="54.1" gradientUnits="userSpaceOnUse" />
                <linearGradient id="aE_tux" xlinkHref="#o_tux" x1="112.9" x2="131.3" y1="36.2" y2="47" gradientUnits="userSpaceOnUse" />
                <linearGradient id="aG_tux" xlinkHref="#m_tux" x1="119.2" x2="131.4" y1="31.6" y2="43.1" gradientUnits="userSpaceOnUse" />
                <linearGradient id="aP_tux" xlinkHref="#r_tux" x1="78.1" x2="126.8" y1="69.3" y2="68.9" gradientUnits="userSpaceOnUse" />
                <linearGradient id="aW_tux" xlinkHref="#t_tux" x1="126.7" x2="126.7" y1="67.5" y2="71.1" gradientUnits="userSpaceOnUse" />
                <filter id="H_tux"><feGaussianBlur stdDeviation="0.64 0.55"/></filter><filter id="K_tux"><feGaussianBlur stdDeviation="1"/></filter><filter id="M_tux"><feGaussianBlur stdDeviation=".7"/></filter><filter id="N_tux" width="2.6" height="1.4" x="-.8" y="-.2"><feGaussianBlur stdDeviation="1.3"/></filter><filter id="O_tux" width="2.6" height="2" x="-.8" y="-.5"><feGaussianBlur stdDeviation="1.78 2.19"/></filter><filter id="P_tux" width="1.6" height="1.6" x="-.3" y="-.3"><feGaussianBlur stdDeviation="1.7"/></filter><filter id="Q_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".8"/></filter><filter id="R_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="1"/></filter><filter id="T_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="1.19 1.17"/></filter><filter id="W_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="3.4"/></filter><filter id="Y_tux"><feGaussianBlur stdDeviation="2.1 2.06"/></filter><filter id="aa_tux"><feGaussianBlur stdDeviation=".3"/></filter><filter id="ac_tux"><feGaussianBlur stdDeviation="1.95 1.9"/></filter><filter id="ae_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="4.1"/></filter><filter id="ag_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="3.12 3.37"/></filter><filter id="ai_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".4"/></filter><filter id="ak_tux" width="1.6" height="1.6" x="-.3" y="-.3"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="am_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="1.12 0.81"/></filter><filter id="ap_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".9"/></filter><filter id="au_tux" width="1.6" height="1.6" x="-.3" y="-.3"><feGaussianBlur stdDeviation=".4"/></filter><filter id="az_tux"><feGaussianBlur stdDeviation=".1"/></filter><filter id="aC_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".5"/></filter><filter id="aH_tux"><feGaussianBlur stdDeviation=".1"/></filter><filter id="aI_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation="1.8"/></filter><filter id="aJ_tux"><feGaussianBlur stdDeviation="0.8 0.74"/></filter><filter id="aM_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".8"/></filter><filter id="aO_tux"><feGaussianBlur stdDeviation=".7"/></filter><filter id="aQ_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".7"/></filter><filter id="aT_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".1"/></filter><filter id="aV_tux"><feGaussianBlur stdDeviation=".1"/></filter><filter id="aX_tux" width="1.4" height="1.4" x="-.2" y="-.2"><feGaussianBlur stdDeviation=".2"/></filter>
                <radialGradient id="G_tux" cx="0" cy="0" r="1" gradientTransform="matrix(19 0 0 18 61 121)" gradientUnits="userSpaceOnUse"><stop offset="0"/><stop offset="1" stopOpacity=".3"/></radialGradient>
                <radialGradient id="J_tux" cx="0" cy="0" r="1" gradientTransform="matrix(24 0 0 18 126 132)" gradientUnits="userSpaceOnUse"><stop offset="0"/><stop offset="1" stopOpacity=".3"/></radialGradient>
                <radialGradient id="L_tux" cx="0" cy="0" r="1" gradientTransform="matrix(9 0 0 10 94 127)" gradientUnits="userSpaceOnUse"><stop offset="0"/><stop offset="1" stopOpacity=".3"/></radialGradient>
                <radialGradient id="aj_tux" cx="0" cy="0" r="1" gradientTransform="matrix(19 5 -5 20 170 195)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#110800"/><stop offset=".6" stopColor="#a65a00" stopOpacity=".8"/><stop offset="1" stopColor="#ff921e" stopOpacity="0"/></radialGradient>
                <radialGradient id="al_tux" cx="0" cy="0" r="1" gradientTransform="matrix(20 -1 1 15 170 190)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#110800"/><stop offset=".6" stopColor="#a65a00" stopOpacity=".8"/><stop offset="1" stopColor="#ff921e" stopOpacity="0"/></radialGradient>
                <radialGradient id="ao_tux" cx="0" cy="0" r="1" gradientTransform="matrix(6 3 -1 3 185 177)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#7c7c7c"/><stop offset="1" stopColor="#7c7c7c" stopOpacity=".3"/></radialGradient>
                <radialGradient id="as_tux" cx="0" cy="0" r="1" gradientTransform="matrix(10 0 0 16 86 51)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fefefc"/><stop offset=".8" stopColor="#fefefc"/><stop offset="1" stopColor="#d4d4d4"/></radialGradient>
                <radialGradient id="aw_tux" cx="0" cy="0" r="1" gradientTransform="matrix(6 -1 1 6 85 44)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#c8c8c8"/><stop offset="1" stopColor="#797978"/></radialGradient>
                <radialGradient id="aA_tux" cx="0" cy="0" r="1" gradientTransform="matrix(14 0 0 16 118 51)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fefefc"/><stop offset=".8" stopColor="#fefefc"/><stop offset="1" stopColor="#d4d4d4"/></radialGradient>
                <radialGradient id="aK_tux" cx="0" cy="0" r="1" gradientTransform="matrix(9 -7 6 8 98 60)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#020204"/><stop offset=".7" stopColor="#020204"/><stop offset="1" stopColor="#5c5c5c"/></radialGradient>
                <radialGradient id="aL_tux" cx="0" cy="0" r="1" gradientTransform="matrix(25 -10 7 18 110 71)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#d2940a"/><stop offset=".8" stopColor="#d89c08"/><stop offset=".9" stopColor="#b67e07"/><stop offset="1" stopColor="#946106"/></radialGradient>
                <radialGradient id="aS_tux" cx="0" cy="0" r="1" gradientTransform="translate(92 60)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3a2903"/><stop offset=".6" stopColor="#735208"/><stop offset="1" stopColor="#ac8c04"/></radialGradient>
                <radialGradient id="aU_tux" cx="0" cy="0" r="1" gradientTransform="matrix(3 0 0 2 105 60)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3a2903"/><stop offset=".6" stopColor="#735208"/><stop offset="1" stopColor="#ac8c04"/></radialGradient>
                <clipPath id="I_tux"><use href="#u_tux"/></clipPath>
                <clipPath id="S_tux"><use href="#v_tux"/></clipPath>
                <clipPath id="U_tux"><use href="#w_tux"/></clipPath>
                <clipPath id="X_tux"><use href="#x_tux"/></clipPath>
                <clipPath id="af_tux"><use href="#y_tux"/></clipPath>
                <clipPath id="aq_tux"><use href="#z_tux"/></clipPath>
                <clipPath id="ax_tux"><use href="#A_tux"/></clipPath>
                <clipPath id="av_tux"><use href="#B_tux"/></clipPath>
                <clipPath id="aF_tux"><use href="#C_tux"/></clipPath>
                <clipPath id="aD_tux"><use href="#D_tux"/></clipPath>
                <clipPath id="aN_tux"><use href="#E_tux"/></clipPath>
                <clipPath id="aR_tux"><use href="#F_tux"/></clipPath>
                <clipPath id="aY_tux"><use href="#E_tux"/><use href="#F_tux"/></clipPath>
              </defs>
              <path id="u_tux" fill="#020204" d="M107 0q-9 0-18 4-8 5-13 14-4 9-4 19-1 20 1 40v10c-1 8-9 13-12 21q-6 12-10 25l-10 23q-5 17-2 35 3 12 12 23l-3 5q-4 6-7 13l-1 8q1 4 4 6l5 3h5q9 0 18-4l11-2a120 120 0 0 1 53 2q9 3 19 4h5l5-3q3-2 4-6l-1-8-7-13-3-6q12-13 18-30 5-18 3-38-3-20-11-37c-7-15-13-20-17-33-4-14-1-31-4-44a44 44 0 0 0-16-23q-10-8-24-8"/>
              <path fill="#fdfdfb" d="m83 74-2 4v4l-1 9-4 8q-6 6-8 14l-1 9a103 103 0 0 0-16 44q-2 17 5 33a55 55 0 0 0 24 27c13 7 30 7 43 0l17-14 10-11q6-11 7-25 4-23-5-45-3-7-9-13-1-11-6-20l-6-13-2-5-4-5q-2-3-5-3l-6-2-12 1-10-1-5 1z"/>
              <path fill="url(#G_tux)" d="M69 115c1 1-1 6 20 3l-8 1-14 7-9 9 7-13v-7l4-9s-2 7 0 9" clipPath="url(#I_tux)" filter="url(#H_tux)" opacity=".3"/>
              <path fill="url(#J_tux)" d="M134 114q-5 4-11 3h-19l6 1 19 4 10 4 11 10-1-7q-4-4-8-12l-2-13s-1 7-5 10" clipPath="url(#I_tux)" filter="url(#K_tux)" opacity=".4"/>
              <path fill="url(#L_tux)" d="m95 108-1 5-1 2-1 1-6 1 2 1h2l1 1 1 1 1 3v5l3-8 2-1 6-2q-3 1-6-2l-2-2z" clipPath="url(#I_tux)" filter="url(#M_tux)" opacity=".2"/>
              <path d="m90 137-2 12-1 18v15l2 7 1-3-1-12 1-21z" clipPath="url(#I_tux)" filter="url(#N_tux)" opacity=".1"/><path fill="#7c7c7c" d="M160 131c1 0 7 5 7 7q-2 2-4 1-2 1-5 1l2-5z" clipPath="url(#I_tux)" filter="url(#O_tux)" opacity=".8"/>
              <path fill="#7c7c7c" d="M122 11q-3 3-1 6c1 2-2 7-2 7l8-4c2-3 7 3 6 2 0-2-9-12-11-11" clipPath="url(#I_tux)" filter="url(#P_tux)"/>
              <path fill="#838384" d="M138 77q-1 2 2 7 2 3 6 4l2-4q-1-5-5-5-2-3-5-2" clipPath="url(#I_tux)" filter="url(#Q_tux)"/>
              <path id="v_tux" fill="#020204" d="M64 101q-9 11-16 21l-4 12-5 13-6 12-3 9v7l3 7a69 69 0 0 0 34 32l7 2 4-1 3-3 1-4-2-5-8-8-24-22q-2-3-3-7-2-10 2-19l3-7q2-6 6-11l9-13 4-14 2-10z"/><path fill="#7c7c7c" d="m57 126-5 6-6 13-2 9v5l-1 5-3 3 4 3 3 5 2 3 4 1 5-1q-2-24 4-47l1-3-1-3-3-1z" clipPath="url(#S_tux)" filter="url(#R_tux)" opacity=".9"/>
              <path id="w_tux" fill="#020204" d="M163 127q8 7 9 17 2 9-1 16l-4 15-2 6 1 6q2 4 5 4h7l9-2q5-7 7-16 1-9-1-18a121 121 0 0 0-15-40l-12-13-3-5-4-5q-2-3-5-3l-6-1q-4 2-6 5l-1 8 4 10 8 9z"/><path fill="#838384" d="m150 119 2 1 8 8q9 8 12 18 0 8-2 15-3 10-7 20c-1 3 2 2 1 4v4-1l3-10 6-18q3-9 1-16-2-10-11-18z" clipPath="url(#U_tux)" filter="url(#T_tux)"/>
              <path id="x_tux" fill="url(#V_tux)" d="M35 175h4l4 2q4 2 7 6l11 17q4 8 9 14l6 9q4 4 5 10 3 7-1 13-2 5-7 8l-9 2q-7-1-15-5-16-5-31-8l-10-3-4-1-3-3-1-3 1-4 3-6 1-11-1-11v-5l2-4 4-2h9l5-2 3-3 2-3 3-4z"/><path fill="#d99a03" d="m37 178 4-1 4 2 5 6 10 17 7 13 7 8 4 8q2 7-1 12l-6 7-9 2q-7-1-14-4l-27-6-9-3-5-1-3-3-1-3 1-3 3-6 1-10-1-10v-4l2-4 4-2h10l4-1q3-1 3-4l2-4 2-4z" clipPath="url(#X_tux)" filter="url(#W_tux)"/>
              <path fill="#f5bd0c" d="m36 175 4-1 4 2 4 6 9 17 8 11q5 7 7 16 2 6-1 12-1 3-6 5-3 2-8 2-6-1-12-4-11-3-22-5l-9-3-4-1-4-2v-3l1-3 2-5v-9l-2-8v-4l2-3q2-3 5-2h10l4-1 3-4 1-5 1-5z" clipPath="url(#X_tux)" filter="url(#Y_tux)"/>
              <path fill="url(#Z_tux)" d="m51 188 6 13 7 11q1 3 5 8l5 9-4-10-4-7-6-10z" clipPath="url(#X_tux)" filter="url(#aa_tux)"/><path fill="url(#ab_tux)" d="m199 216-2 3-7 7-13 9-7 8-6 7-8 5h-11l-6-4-2-7 1-13 1-11-1-20v-4l1-3 3-1 3-1h7l5 1 7-1 8-2h4l3 1 1 2 1 3 1 4q0 3 3 4l4 4 5 2 2 2 2 1z" clipPath="url(#I_tux)" filter="url(#ac_tux)" opacity=".2"/><path id="y_tux" fill="url(#ad_tux)" d="M213 223q-3 4-8 6l-16 8-9 8-8 7-12 4-10-2-7-5-1-9 1-16 2-12 1-24v-4l1-4 4-1h3l9 2 5 1q5 2 9 1l10-1h4l3 2 2 3 1 5v4l3 6 5 4 6 5 2 1 2 3 1 4z"/><path fill="#cd8907" d="m213 216-2 4-8 5-14 8-9 7-7 6q-3 3-8 3-6 1-12-1l-6-5-2-8 2-14 2-11v-25q0-3 2-3l3-2 3 1 8 1 5 1q3 2 8 1l9-1h3l4 2 1 3 1 4v4l1 3 2 3 5 5 7 4 2 1z" clipPath="url(#af_tux)" filter="url(#ae_tux)"/>
              <path fill="#f5c021" d="m213 215-2 3q-3 4-8 6l-16 4-8 5-7 4-14 3-5-2q-2 0-3-3l-1-5 1-13-1-12v-22l-1-4v-2l1-1 2-1h1l3 1 8 1 5 2 8 1 9-2 4 1 3 2 2 2 1 4v5l1 1 1 2 3 5 4 5 7 4 1 2z" clipPath="url(#af_tux)" filter="url(#ag_tux)"/><path fill="url(#ah_tux)" d="M148 182q4-1 7 3h5l8 1 16-2q4-2 8 1 1 2 3 2-2-4-5-6h-7l-19-1h-13q-3 0-4 1z" clipPath="url(#af_tux)" filter="url(#ai_tux)"/>
              <path fill="url(#aj_tux)" d="m185 188-2-2-3-1h-6l-6-1h-5l-5 4-1 4v9l2 4 4 3h9a24 24 0 0 0 14-16v-2z" clipPath="url(#af_tux)" filter="url(#ak_tux)" opacity=".3"/>
              <path fill="url(#al_tux)" d="m185 185-2-2h-9l-6-1h-5l-5 3-1 3v7l2 2 4 3h9q8-3 12-8l2-4v-2z" clipPath="url(#af_tux)" filter="url(#am_tux)" opacity=".3"/><path id="z_tux" fill="#020204" d="m190 179-2-3-3-1-6-2-5-1h-6l-5 2-3 5-1 9 2 6 5 3h9q8-3 13-10l2-4z"/>
              <defs><path id="an_tux" d="M169 171h-2l-7 5-1 6 1-4q2-3 6-4h5l4 1 7 2 1 1v4l-1 2-2 1 6-2 2-2 1-3-1-2-2-1-7-3z"/></defs>
              <use xlinkHref="#an_tux" fill="url(#ao_tux)" clipPath="url(#aq_tux)" filter="url(#ap_tux)" href="#an_tux"/>
              <use xlinkHref="#an_tux" fill="url(#ar_tux)" clipPath="url(#aq_tux)" filter="url(#ap_tux)" href="#an_tux"/>
              <path id="A_tux" fill="url(#as_tux)" d="m84 38-4 2-2 4-1 9 2 8 2 4 4 2h3l4-2 3-5v-6l-1-7-3-6-3-2z"/>
              <path id="B_tux" fill="#020204" d="M81 51v6l2 3 2 2h3l2-1 1-2-1-7-2-4-2-2-3 1-1 1z"/>
              <path fill="url(#at_tux)" d="m85 50 1 1 1 1 1 3h1v-4l-2-2h-2z" clipPath="url(#av_tux)" filter="url(#au_tux)"/>
              <path fill="url(#aw_tux)" d="m81 44 8-1 8 2 5 2q3 1 5 3v1l1 1h2v-1l-4-7-2-4q-3-7-11-10l-14-4a75 75 0 0 0-25 4l-3 2-2 4 1 3 2 4 5 5 6 4 3 2h4l3-2 3-2z" clipPath="url(#ax_tux)"/>
              <path fill="url(#ay_tux)" d="m91 37 5 7q-1-5-4-7l-3-3-4-1h-1q-1 0 0 0l3 1z" filter="url(#az_tux)"/>
              <path id="C_tux" fill="url(#aA_tux)" d="M112 38q-5 3-6 7-2 5 1 11 1 5 6 9l5 2 6-1 4-5 2-7-1-8q-1-5-6-8l-4-2z"/>
              <path id="D_tux" fill="#020204" d="M117 46h-2l-2 2-2 5 1 4 2 4 4 1a6 6 0 0 0 6-3l1-4-1-5-4-4z"/>
              <path fill="url(#aB_tux)" d="M123 53q1-2-2-4l-4-1 2 3q2 3 4 2" clipPath="url(#aD_tux)" filter="url(#aC_tux)"/>
              <path fill="url(#aE_tux)" d="m103 47 7-4q8-2 15 2l5 4 5 3h3l2-1 2-2q2-3 1-5-1-5-4-11l-2-3q-3-4-8-6l-11-2h-4l-6 2h-2l-2 1-2 4v3l1 8-1 5z" clipPath="url(#aF_tux)"/>
              <path fill="url(#aG_tux)" d="m120 31-1 2 5 2 7 8 1-1q-3-5-7-9z" filter="url(#aH_tux)"/>
              <path fillOpacity=".3" d="M81 89a24 24 0 0 0 12 13l4 1 4-1 4-2 7-4 7-5 3-3 4-1h3l2 1 1-1 1-2-1-2-2-3v-3l-1-4-1-2h-15l-8 1H95l-4 1H80l-2 2-1 1 1 1 1 3z" clipPath="url(#I_tux)" filter="url(#aI_tux)"/>
              <path d="m77 77 8 7 6 6 6 2 8-1 7-2q6-5 11-7l3-1 2-2 1-3 1-3-1-2-1-2-3-1-5 1h-7l-8 1-10-1h-4l-4 2-3 2-2 1-2 1h-1l-2 1z" clipPath="url(#I_tux)" filter="url(#aJ_tux)" opacity=".3"/>
              <path fill="url(#aK_tux)" d="m92 59 4-6 2-2 4-1 3 2 2 3 2 3 3 2 1 2 1 1v2l-1 2-4 2-8-1-8 1-3-1-2-1v-4l1-2z"/>
              <path id="E_tux" fill="url(#aL_tux)" d="M77 75zl1 1h1l6 5q2 5 6 8l6 2 8-1 7-3 11-8 3-1 2-2 1-3 1-3-1-3-1-2h-15l-8 1H91l-4 1-3 3-2 1-2 1h-2v1z"/>
              <path fill="#d9b30d" d="M90 79a6 6 0 0 0 4 6h5l2-2 1-2v-1l-1-2h-2l-4-1q-4 0-5 2" clipPath="url(#aN_tux)" filter="url(#aM_tux)"/>
              <path fill="#604405" d="m84 68-3 2-1 2-1 1v3l1 1h1l2 1 2 3 8 2 9-1 6-2 9-5 3-3 4-2h1v-1l-1-1-5-2h-5l-4-1-5-1a31 31 0 0 0-21 4" clipPath="url(#aN_tux)" filter="url(#aO_tux)"/>
              <path id="F_tux" fill="url(#aP_tux)" d="m84 64-4 4-2 3-1 3v2h2l3 1 3 3 8 2 9-1 6-2 12-8 2-1 1-1h6v-2l-2-2-3-1-10-3-4-3-5-2q-5-1-11 1t-10 7"/><path fill="#f6da4a" d="M109 65zh-1l-2 1-4 4-3 6v2l1 1h1l2-2q5-3 7-9z" clipPath="url(#aR_tux)" filter="url(#aQ_tux)"/>
              <path fill="url(#aS_tux)" d="m93 59-2 2h1z" filter="url(#aT_tux)" opacity=".8"/>
              <path fill="url(#aU_tux)" d="m103 59 1 1 2 1 1-1-1-1z" filter="url(#aV_tux)" opacity=".8"/>
              <path fill="url(#aW_tux)" d="M129 69a2 3 17 0 1-3 3 2 3 17 0 1-2-3 2 3 17 0 1 3-3 2 3 17 0 1 2 3" clipPath="url(#aY_tux)" filter="url(#aX_tux)"/>
            </svg>
            <div className="client-info">
              <span className="client-name">Linux</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Report Modal (Bugs/Features) */}
      {isReporting && (
        <div className="modal-overlay">
          <div className="modal-content settings-card">
            <h3>{t(`suggest_feature` as any)} / {t(`report_bug` as any)}</h3>
            <form onSubmit={submitCustomReport}>
              <div className="form-group">
                <label>{t('issue_title')}</label>
                <input 
                  type="text" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)} 
                  required 
                  className="settings-input"
                  placeholder={isReporting === 'feature' ? 'New feature idea' : 'Describe the bug'}
                />
              </div>
              <div className="form-group">
                <label>{t('issue_description')}</label>
                <textarea 
                  value={reportDesc} 
                  onChange={e => setReportDesc(e.target.value)} 
                  required 
                  className="settings-input settings-textarea"
                />
              </div>
              {reportStatus && (
                <div className={`report-status ${reportStatus.success ? 'success' : 'error'}`}>
                  {reportStatus.message}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="settings-btn cancel-btn" onClick={() => setIsReporting(null)} disabled={isSubmitting}>
                  {t('cancel')}
                </button>
                <button type="submit" className="settings-btn login-btn" disabled={isSubmitting}>
                  {isSubmitting ? '...' : t('submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
