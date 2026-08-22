import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { organizationsService, Organization } from '@/services/organizations.service';
import { sanitizeUuidCandidate } from '@/utils/uuid';
import { logger } from '@/services/monitoring/logger';

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string, description?: string) => Promise<Organization>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

const CURRENT_ORG_KEY = 'openplan-current-org';

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      hasLoadedOnceRef.current = false;
      setOrganizations([]);
      setCurrentOrganizationState(null);
      // While auth is still bootstrapping (cookie probe in flight), stay in the
      // loading state — otherwise consumers briefly see "resolved, no org" and
      // flash an empty state before the org actually loads.
      setIsLoading(authLoading);
      return;
    }

    const showGlobalLoading = !hasLoadedOnceRef.current;
    try {
      if (showGlobalLoading) setIsLoading(true);
      const orgs = await organizationsService.getAll();
      setOrganizations(orgs);

      // Restore last selected org or pick first (sanitize: quoted/pasted IDs break Postgres uuid)
      const rawSavedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
      const savedOrgId = rawSavedOrgId ? sanitizeUuidCandidate(rawSavedOrgId) : '';
      const savedOrg = savedOrgId ? orgs.find((o) => o.id === savedOrgId) ?? null : null;
      if (rawSavedOrgId && savedOrg && rawSavedOrgId !== savedOrg.id) {
        localStorage.setItem(CURRENT_ORG_KEY, savedOrg.id);
      }
      // Prefer an org the user can actually use. A member of one live org plus one
      // awaiting approval would otherwise land on the pending one and meet bare
      // 403s across the whole dashboard, with nothing saying why.
      const usable = orgs.find((o) => o.status !== 'pending_review' && o.status !== 'rejected');
      setCurrentOrganizationState(savedOrg || usable || orgs[0] || null);
    } catch (error) {
      logger.error('Error fetching organizations:', error);
      setOrganizations([]);
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations, user?.id]);

  const setCurrentOrganization = useCallback((org: Organization | null) => {
    setCurrentOrganizationState(org);
    if (org) {
      localStorage.setItem(CURRENT_ORG_KEY, org.id);
    } else {
      localStorage.removeItem(CURRENT_ORG_KEY);
    }
  }, []);

  const createOrganization = useCallback(async (name: string, description?: string) => {
    const slug = organizationsService.generateSlug(name);
    const newOrg = await organizationsService.create({ name, slug, description });
    setOrganizations(prev => [...prev, newOrg]);
    setCurrentOrganization(newOrg);
    return newOrg;
  }, [setCurrentOrganization]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      currentOrganization,
      isLoading,
      setCurrentOrganization,
      refreshOrganizations: fetchOrganizations,
      createOrganization,
    }),
    [
      organizations,
      currentOrganization,
      isLoading,
      setCurrentOrganization,
      fetchOrganizations,
      createOrganization,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
