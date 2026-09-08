import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, deleteUser, type User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { type Language, translations } from './i18n';
import { AndroidIcon, WindowsIcon, MacOSIcon, LinuxIcon } from './Icons';
import { REPORTER_URL } from './constants';

interface NavigatorUAData {
  userAgentData?: {
    platform?: string;
    getHighEntropyValues: (hints: string[]) => Promise<{ architecture?: string }>;
  };
}

type OS = 'android' | 'windows' | 'macos' | 'linux';

const detectOS = (): OS | null => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  const nav = navigator as Navigator & NavigatorUAData;
  const platformHint = nav.userAgentData?.platform?.toLowerCase() || '';
  if (platformHint === 'windows') return 'windows';
  if (platformHint === 'macos') return 'macos';
  if (platformHint === 'android') return 'android';
  if (platformHint === 'linux') return 'linux';

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // Android check (must precede Linux because Android UA contains 'linux')
  if (ua.includes('android')) return 'android';

  // Windows check
  if (ua.includes('windows') || ua.includes('win32') || platform.includes('win')) return 'windows';

  // macOS check (excluding iPhone / iPad)
  if ((ua.includes('macintosh') || ua.includes('mac os x') || platform.includes('mac')) && !ua.includes('iphone') && !ua.includes('ipad')) {
    return 'macos';
  }

  // Linux check
  if (ua.includes('linux') || platform.includes('linux')) return 'linux';

  return null;
};

const detectSystemArch = async (): Promise<'arm64' | 'x64' | null> => {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & NavigatorUAData) : null;
    if (nav?.userAgentData?.getHighEntropyValues) {
      const hints = await nav.userAgentData.getHighEntropyValues(['architecture']);
      const arch = String(hints?.architecture || '').toLowerCase();
      if (arch.includes('arm') || arch.includes('aarch')) return 'arm64';
      if (arch.includes('x86') || arch.includes('amd64') || arch.includes('x64')) return 'x64';
    }

    const ua = navigator.userAgent || '';
    if (/arm64|aarch64/i.test(ua)) return 'arm64';
    if (/x86_64|x86-64|Win64|x64|WOW64|amd64/i.test(ua)) return 'x64';

    const platform = (navigator.platform || '').toLowerCase();
    if (platform.includes('aarch64') || platform.includes('arm')) return 'arm64';
    if (platform.includes('x86_64') || platform.includes('x86-64') || platform.includes('win64') || platform.includes('x64')) return 'x64';

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (typeof renderer === 'string') {
          if (/Apple M|Apple GPU|Adreno|Mali|Immortalis/i.test(renderer)) return 'arm64';
          if (/Intel|AMD|Radeon|Nvidia|GeForce/i.test(renderer)) return 'x64';
        }
      }
    }
  } catch {
    // Fail silently and return null
  }
  return null;
};

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

  const [showMacModal, setShowMacModal] = useState(false);
  const [isMacClosing, setIsMacClosing] = useState(false);
  const [detectedArch, setDetectedArch] = useState<'arm64' | 'x64' | null>(null);

  const [detectedOS] = useState<OS | null>(() => detectOS());
  const defaultOrder: OS[] = ['android', 'windows', 'macos', 'linux'];
  const clientOrder = detectedOS
    ? [detectedOS, ...defaultOrder.filter(os => os !== detectedOS)]
    : defaultOrder;

  useEffect(() => {
    let isMounted = true;
    detectSystemArch().then((arch) => {
      if (isMounted && arch) {
        setDetectedArch(arch);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showMacModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMacModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMacModal]);

  const openMacModal = () => {
    setIsMacClosing(false);
    setShowMacModal(true);
  };

  const closeMacModal = () => {
    setIsMacClosing(true);
    setTimeout(() => {
      setShowMacModal(false);
      setIsMacClosing(false);
    }, 300);
  };

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
          {clientOrder.map(os => {
            const isRecommended = detectedOS === os;
            switch (os) {
              case 'android':
                return (
                  <a 
                    key="android" 
                    href="https://play.google.com/store/apps/details?id=com.cukbab" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`client-item android ${isRecommended ? 'recommended' : ''}`}
                  >
                    {isRecommended && (
                      <span className="client-recommended-badge">{t('recommended')}</span>
                    )}
                    <AndroidIcon className="client-icon" />
                    <div className="client-info">
                      <span className="client-name">Android</span>
                      <span className="client-link">{t('download_now')}</span>
                    </div>
                  </a>
                );
              case 'windows':
                return (
                  <a 
                    key="windows" 
                    href="https://github.com/CUKbab/CUK_PC/releases/latest/download/CUK.-windows-x64.zip" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`client-item Windows ${isRecommended ? 'recommended' : ''}`}
                  >
                    {isRecommended && (
                      <span className="client-recommended-badge">{t('recommended')}</span>
                    )}
                    <WindowsIcon className="client-icon" />
                    <div className="client-info">
                      <span className="client-name">Windows</span>
                      <span className="client-link">{t('download_now')}</span>
                    </div>
                  </a>
                );
              case 'macos':
                return (
                  <div 
                    key="macos"
                    className={`client-item macOS ${isRecommended ? 'recommended' : ''}`}
                    onClick={openMacModal} 
                    role="button" 
                    tabIndex={0} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openMacModal();
                      }
                    }}
                  >
                    {isRecommended && (
                      <span className="client-recommended-badge">{t('recommended')}</span>
                    )}
                    <MacOSIcon className="client-icon" />
                    <div className="client-info">
                      <span className="client-name">macOS</span>
                      <span className="client-link">{t('download_now')}</span>
                    </div>
                  </div>
                );
              case 'linux':
                return (
                  <a 
                    key="linux" 
                    href="https://github.com/CUKbab/CUK_PC/releases/latest/download/CUK.-linux-x64.tar.gz" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`client-item Linux ${isRecommended ? 'recommended' : ''}`}
                  >
                    {isRecommended && (
                      <span className="client-recommended-badge">{t('recommended')}</span>
                    )}
                    <LinuxIcon className="client-icon" />
                    <div className="client-info">
                      <span className="client-name">Linux</span>
                      <span className="client-link">{t('download_now')}</span>
                    </div>
                  </a>
                );
            }
          })}
        </div>
      </section>

      {/* Custom Report Modal */}
      {isReporting && (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className={`modal-content settings-card ${isClosing ? 'closing' : ''}`}>
            <h3>{t('suggest_feature')} / {t('report_bug')}</h3>
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

      {/* macOS Architecture Selection Modal */}
      {showMacModal && (
        <div 
          className={`modal-overlay ${isMacClosing ? 'closing' : ''}`} 
          onClick={(e) => e.target === e.currentTarget && closeMacModal()}
        >
          <div className={`modal-content settings-card mac-modal-content ${isMacClosing ? 'closing' : ''}`}>
            <div className="mac-modal-header">
              <MacOSIcon className="mac-modal-icon" />
              <div>
                <h3 className="mac-modal-title">{t('macos_download_title')}</h3>
                <p className="mac-modal-desc">{t('macos_download_desc')}</p>
              </div>
            </div>

            <div className="mac-arch-list">
              {/* Apple Silicon (arm64) */}
              <a
                href="https://github.com/CUKbab/CUK_PC/releases/latest/download/CUK.-macos-arm64.dmg"
                target="_blank"
                rel="noopener noreferrer"
                className={`mac-arch-card ${detectedArch === 'arm64' ? 'recommended' : ''}`}
                onClick={closeMacModal}
              >
                <div className="mac-arch-info">
                  <div className="mac-arch-title-row">
                    <span className="mac-arch-name">{t('mac_arm64_title')}</span>
                    <span className="mac-arch-tag">arm64</span>
                    {detectedArch === 'arm64' && (
                      <span className="mac-arch-badge">{t('recommended')}</span>
                    )}
                  </div>
                  <span className="mac-arch-sub">{t('mac_arm64_desc')}</span>
                </div>
                <span className="mac-arch-download-btn">{t('download_now')}</span>
              </a>

              {/* Intel (x64) */}
              <a
                href="https://github.com/CUKbab/CUK_PC/releases/latest/download/CUK.-macos-x64.dmg"
                target="_blank"
                rel="noopener noreferrer"
                className={`mac-arch-card ${detectedArch === 'x64' ? 'recommended' : ''}`}
                onClick={closeMacModal}
              >
                <div className="mac-arch-info">
                  <div className="mac-arch-title-row">
                    <span className="mac-arch-name">{t('mac_x64_title')}</span>
                    <span className="mac-arch-tag">x64</span>
                    {detectedArch === 'x64' && (
                      <span className="mac-arch-badge">{t('recommended')}</span>
                    )}
                  </div>
                  <span className="mac-arch-sub">{t('mac_x64_desc')}</span>
                </div>
                <span className="mac-arch-download-btn">{t('download_now')}</span>
              </a>
            </div>

            <div className="modal-actions">
              <button type="button" className="settings-btn cancel-btn" onClick={closeMacModal}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
