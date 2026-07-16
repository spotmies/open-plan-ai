import { useEffect, useState } from 'react';

export function useGoogleIdentityServices() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if script is already present
    const existingScript = document.getElementById('google-gis-script');
    if (existingScript) {
      setIsLoaded(true);
      return;
    }

    if (window.google?.accounts?.oauth2) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gis-script';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      setError(new Error('Failed to load Google Identity Services SDK'));
    };

    document.head.appendChild(script);

    return () => {
      // Keep script in head to prevent duplicate loads, but we could clean it up if desired.
      // Usually, it's safer to keep it loaded globally.
    };
  }, []);

  return { isLoaded, error };
}
