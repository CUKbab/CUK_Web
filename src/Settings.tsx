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
