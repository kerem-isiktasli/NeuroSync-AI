"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  loadPatientProfile,
  savePatientProfile as persistProfile,
  saveAnalysisIntake as persistIntake,
} from "@/lib/patientStore";
import type { PatientProfile, AnalysisIntake } from "@/types/intake";
import {
  EMPTY_PATIENT_PROFILE,
  EMPTY_ANALYSIS_INTAKE,
  isProfileComplete,
  isIntakeComplete,
  validateProfileRequired,
  validateIntakeRequired,
} from "@/types/intake";

// ─── Context shape ──────────────────────────────────────────────────

interface PatientContextType {
  uid: string | null;
  loading: boolean;

  // OBJECT 1: Profile
  profile: PatientProfile;
  profileComplete: boolean;
  profileMissingFields: string[];
  updateProfile: (patch: Partial<PatientProfile>) => Promise<void>;

  // OBJECT 2: Current analysis intake (in-progress, not yet saved)
  currentIntake: AnalysisIntake;
  intakeComplete: boolean;
  intakeMissingFields: string[];
  patchIntake: (patch: Partial<AnalysisIntake>) => void;
  resetIntake: () => void;

  /** Save current intake to Firestore. Returns the intake doc ID. */
  saveCurrentIntake: (analysisId: string) => Promise<string | null>;

  /** Whether upload should be allowed (both gates pass) */
  canUpload: boolean;

  /** Quick mode: skip detailed intake form, use empty intake */
  quickModeSelected: boolean;
  setQuickModeSelected: (v: boolean) => void;

  /** Reload profile from Firestore */
  refresh: () => Promise<void>;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile>({ ...EMPTY_PATIENT_PROFILE });
  const [currentIntake, setCurrentIntake] = useState<AnalysisIntake>({ ...EMPTY_ANALYSIS_INTAKE });
  const [quickModeSelected, setQuickModeSelected] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const p = await loadPatientProfile(userId);
      setProfile(p);
    } catch (err) {
      console.warn("[PatientContext] Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        loadData(user.uid);
      } else {
        setUid(null);
        setProfile({ ...EMPTY_PATIENT_PROFILE });
        setCurrentIntake({ ...EMPTY_ANALYSIS_INTAKE });
        setQuickModeSelected(false);
        setLoading(false);
      }
    });
    return unsub;
  }, [loadData]);

  const updateProfile = useCallback(
    async (patch: Partial<PatientProfile>) => {
      if (!uid) return;
      const merged = { ...profile, ...patch, updatedAt: new Date().toISOString() };
      setProfile(merged);
      try {
        await persistProfile(uid, merged);
      } catch (err) {
        console.error("[PatientContext] Failed to save profile:", err);
      }
    },
    [uid, profile]
  );

  const patchIntake = useCallback(
    (patch: Partial<AnalysisIntake>) => {
      setCurrentIntake((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const resetIntake = useCallback(() => {
    setCurrentIntake({ ...EMPTY_ANALYSIS_INTAKE });
    setQuickModeSelected(false);
  }, []);

  const saveCurrentIntake = useCallback(
    async (analysisId: string): Promise<string | null> => {
      if (!uid) return null;
      try {
        const toSave = { ...currentIntake, analysisId, userId: uid };
        const id = await persistIntake(toSave);
        return id;
      } catch (err) {
        console.error("[PatientContext] Failed to save intake:", err);
        return null;
      }
    },
    [uid, currentIntake]
  );

  const refresh = useCallback(async () => {
    if (uid) await loadData(uid);
  }, [uid, loadData]);

  const profileMissingFields = useMemo(() => validateProfileRequired(profile), [profile]);
  const intakeMissingFields = useMemo(() => validateIntakeRequired(currentIntake), [currentIntake]);
  const profileOk = useMemo(() => isProfileComplete(profile), [profile]);
  const intakeOk = useMemo(() => isIntakeComplete(currentIntake), [currentIntake]);
  const step2Complete = intakeOk || quickModeSelected;

  return (
    <PatientContext.Provider
      value={{
        uid,
        loading,
        profile,
        profileComplete: profileOk,
        profileMissingFields,
        updateProfile,
        currentIntake,
        intakeComplete: step2Complete,
        intakeMissingFields,
        patchIntake,
        resetIntake,
        saveCurrentIntake,
        canUpload: profileOk && step2Complete,
        quickModeSelected,
        setQuickModeSelected,
        refresh,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}
