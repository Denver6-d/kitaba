import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LeaderboardRepository, NicknameStatus, SubmitStatus } from "@/repositories/types";

const rowSchema = z.object({
  rank: z.number().int(),
  nickname: z.string().max(40),
  wpm: z.coerce.number(),
  accuracy: z.coerce.number(),
  achieved_at: z.string(),
});
const submitSchema = z.object({ status: z.enum(["ok", "not_opted_in", "too_short", "low_accuracy", "implausible", "rate_limited"]) });
const nicknameSchema = z.object({ status: z.enum(["ok", "length", "chars", "blocked", "taken"]) });

/** Leaderboard over the Supabase views and RPCs in 20261117000002_leaderboard.sql. */
export function createSupabaseLeaderboard(client: SupabaseClient): LeaderboardRepository {
  return {
    async top(board) {
      const { data, error } = await client
        .from(board === "weekly" ? "leaderboard_weekly" : "leaderboard_all_time")
        .select("rank,nickname,wpm,accuracy,achieved_at")
        .order("rank")
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []).flatMap((r) => {
        const p = rowSchema.safeParse(r);
        return p.success ? [{ rank: p.data.rank, nickname: p.data.nickname, wpm: p.data.wpm, accuracy: p.data.accuracy, achievedAt: p.data.achieved_at }] : [];
      });
    },
    async myNickname() {
      // RLS returns only the caller's own profile row.
      const { data, error } = await client.from("leaderboard_profiles").select("nickname").maybeSingle();
      if (error) throw new Error(error.message);
      const p = z.object({ nickname: z.string() }).nullable().safeParse(data);
      return p.success ? (p.data?.nickname ?? null) : null;
    },
    async setNickname(nickname): Promise<NicknameStatus> {
      const { data, error } = await client.rpc("set_leaderboard_nickname", { p_nickname: nickname });
      if (error) return "error";
      const s = nicknameSchema.safeParse(data);
      return s.success ? s.data.status : "error";
    },
    async leave() {
      const { error } = await client.rpc("leave_leaderboard");
      if (error) throw new Error(error.message);
    },
    async submit(score): Promise<SubmitStatus> {
      const { data, error } = await client.rpc("submit_score", {
        p_wpm: Math.round(score.wpm * 10) / 10,
        p_accuracy: Math.round(score.accuracy * 10) / 10,
        p_duration_s: Math.round(score.durationS),
        p_chars: Math.round(score.chars),
      });
      if (error) return "error";
      const s = submitSchema.safeParse(data);
      return s.success ? s.data.status : "error";
    },
  };
}
