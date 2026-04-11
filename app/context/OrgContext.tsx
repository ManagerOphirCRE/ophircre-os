"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export const OrgContext = createContext<{ orgId: string | null }>({ orgId: null });

export function useOrg() {
  return useContext(OrgContext);
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const[orgId, setOrgId] = useState<string | null>(null);

  const loadOrg = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;
    const { data } = await supabase.from('user_roles').select('organization_id').eq('email', session.user.email).single();
    if (data) setOrgId(data.organization_id);
  };

  const emptyDependencyArray = new Array(0);

  useEffect(() => {
    loadOrg();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadOrg();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, emptyDependencyArray);

  return (
    <OrgContext.Provider value={{ orgId }}>
      {children}
    </OrgContext.Provider>
  );
}