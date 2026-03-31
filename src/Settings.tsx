import React, { useState } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, deleteUser, type User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { type Language, translations } from './i18n';
import { AndroidIcon, WindowsIcon, MacOSIcon, LinuxIcon } from './Icons';
import { REPORTER_URL } from './constants';

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
  const [isClosing, setIsClosing] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsReporting(null);
      setIsClosing(false);
      setReportStatus(null);
    }, 300);
  };

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

  const sendReport = async (title: string, body: string, labels: string[]) => {
    const reportData = {
      title,
      body,
      labels,
      userEmail: user?.email || null,
      userId: user?.uid || null
    };

    // GitHub Worker reporting (no-cors mode)
    const workerPromise = fetch(REPORTER_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(reportData)
    });

    // Firestore logging
    const firestorePromise = addDoc(collection(db, 'reports'), {
      ...reportData,
      timestamp: Date.now()
    });

    return Promise.allSettled([workerPromise, firestorePromise]);
  };

  const handleQuickMenuReport = async () => {
    if (isSubmitting || !user) return;
    setIsSubmitting(true);
    try {
      await sendReport('Menu Error', 'Menu Error', ['menu-error', 'reported-via-web']);
      alert(t('report_success'));
    } catch (error) {
      console.error(error);
      alert(t('report_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCustomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setReportStatus(null);

    try {
      await sendReport(reportTitle, reportDesc, [isReporting || 'bug']);
      setReportStatus({ success: true, message: t('report_success') });
      setReportTitle('');
      setReportDesc('');
      setTimeout(closeModal, 2000);
    } catch (error) {
      console.error(error);
      setReportStatus({ success: false, message: t('report_error') });
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
            className={`feedback-btn ${!user ? 'locked' : ''}`} 
            onClick={() => user ? handleQuickMenuReport() : alert(t('feature_requires_login'))} 
            disabled={isSubmitting}
            title={!user ? t('feature_requires_login') : ''}
          >
            {isSubmitting ? '...' : t('report_menu_error')} {!user && '🔒'}
          </button>
          
          <button 
            className={`feedback-btn ${!user ? 'locked' : ''}`} 
            onClick={() => user ? setIsReporting('feature') : alert(t('feature_requires_login'))}
            title={!user ? t('feature_requires_login') : ''}
          >
            {t('suggest_feature')} {!user && '🔒'}
          </button>
          
          <button 
            className={`feedback-btn ${!user ? 'locked' : ''}`} 
            onClick={() => user ? setIsReporting('bug') : alert(t('feature_requires_login'))}
            title={!user ? t('feature_requires_login') : ''}
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
            <AndroidIcon className="client-icon" />
            <div className="client-info">
              <span className="client-name">Android</span>
              <a href="https://play.google.com/store/apps/details?id=com.cukbab" target="_blank" rel="noopener noreferrer" className="client-link">
                {t('download_now')}
              </a>
            </div>
          </div>

          <div className="client-item coming-soon">
            <WindowsIcon className="client-icon" />
            <div className="client-info">
              <span className="client-name">Windows</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>

          <div className="client-item coming-soon">
            <MacOSIcon className="client-icon" />
            <div className="client-info">
              <span className="client-name">macOS</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>

          <div className="client-item coming-soon">
            <LinuxIcon className="client-icon" />
            <div className="client-info">
              <span className="client-name">Linux</span>
              <span className="client-status">{t('coming_soon')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Report Modal */}
      {isReporting && (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className={`modal-content settings-card ${isClosing ? 'closing' : ''}`}>
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
                <button type="button" className="settings-btn cancel-btn" onClick={closeModal} disabled={isSubmitting}>
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
