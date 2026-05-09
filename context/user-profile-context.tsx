import { createContext, ReactNode, useContext, useMemo, useState } from "react";

/* ---------------- TYPES ---------------- */

export type Post = {
  id: string;
  author: string;
  initials: string;
  vehicle: string;
  content: string;
  likes: number;
  comments: any[];
  shares: number;
  likedByMe: boolean;
  createdAtLabel: string;
};

/* ---------------- PROFILE TYPE ---------------- */

export type UserProfileData = {
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    drivingExperience: number | null;
  };

  vehicle?: {
    brand: string;
    model: string;
    year: number;
    engineCapacity: number;
    mileage: number;
    transmission: string;
    fuelType: string;
    enginePowerHp?: number;
    weightKg?: number;
    fuelCombined?: number;
    bodyType?: string;
    tankCapacity?: number;
  };

  stats?: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };

  posts: Post[];
};

/* ---------------- INITIAL STATE ---------------- */

const INITIAL_PROFILE: UserProfileData = {
  user: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    drivingExperience: null,
  },

  vehicle: {
    brand: "",
    model: "",
    year: 0,
    engineCapacity: 0,
    mileage: 0,
    transmission: "",
    fuelType: "",
  },

  stats: {
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  },

 posts: [
    {
      id: "1",
      author: "khaled ali",
      initials: "KA",
      vehicle: "Toyota Camry",
      content: "First trip 🚗🔥",
      likes: 10,
      comments: [],
      shares: 0,
      likedByMe: false,
      createdAtLabel: "2h ago",
    },
  ],
};

/* ---------------- CONTEXT ---------------- */

type UserProfileContextType = {
  profile: UserProfileData;
  updateProfile: (patch: Partial<UserProfileData>) => void;
};

const UserProfileContext = createContext<UserProfileContextType | null>(null);

/* ---------------- PROVIDER ---------------- */

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfileData>(INITIAL_PROFILE);

  const value = useMemo(
    () => ({
      profile,

updateProfile: (patch: Partial<UserProfileData>) => {
  setProfile((prev) => ({
    ...prev,
    ...patch,
    user: patch.user ?? prev.user,
    vehicle: patch.vehicle ?? prev.vehicle,
    stats: patch.stats ?? prev.stats,
    posts: patch.posts ?? prev.posts,
  }));
},
    }),
    [profile]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

/* ---------------- HOOK ---------------- */

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return context;
}