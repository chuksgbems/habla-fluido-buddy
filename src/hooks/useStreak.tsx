import { useAuth } from "@/hooks/useAuth";

export function useStreak() {
  const { user, profile, updateProfile } = useAuth();

  const updateStreak = async () => {
    if (!user || !profile) return;
    const today = new Date().toISOString().split("T")[0];
    const lastActivity = profile.last_activity_date;

    let newStreak = profile.streak_days || 0;

    if (lastActivity === today) {
      return; // Already active today
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastActivity === yesterdayStr) {
      newStreak += 1;
    } else if (!lastActivity) {
      newStreak = 1;
    } else {
      newStreak = 1; // Streak broken
    }

    await updateProfile({
      streak_days: newStreak,
      last_activity_date: today,
    });
  };

  return { updateStreak };
}
