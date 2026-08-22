declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const initializeGA = () => {
  if (!window.gtag) {
    console.warn('Google Analytics not loaded');
    return;
  }
};

export const trackPageView = (path: string, title?: string) => {
  if (!window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
};

export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, string | number | boolean>
) => {
  if (!window.gtag) return;

  window.gtag('event', eventName, eventParams);
};

export const setUserId = (userId: string) => {
  if (!window.gtag) return;

  window.gtag('config', 'G-PQEQRP4K01', {
    user_id: userId,
  });
};

export const setUserProperties = (properties: Record<string, string | number>) => {
  if (!window.gtag) return;

  window.gtag('set', properties);
};

// Domain-specific event helpers
export const trackBomEvent = (action: string, label?: string, value?: number) => {
  trackEvent('bom_engagement', {
    action,
    label: label || '',
    value: value || 0,
  });
};

export const trackEcoEvent = (action: string, label?: string) => {
  trackEvent('eco_engagement', {
    action,
    label: label || '',
  });
};

export const trackTaskEvent = (action: string, label?: string) => {
  trackEvent('task_engagement', {
    action,
    label: label || '',
  });
};

export const trackAuthEvent = (action: 'login' | 'signup' | 'logout') => {
  trackEvent('auth_engagement', {
    action,
  });
};
