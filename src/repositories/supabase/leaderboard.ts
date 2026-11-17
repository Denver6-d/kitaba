import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LeaderboardRepository, NicknameStatus, SubmitStatus } from "@/repositories/types";

const rowSchema = z.object({
  rank: z.number().int(),
  nickname: z.string().max(40),
  points: z.coerce.number(),
  words: z.coerce.number(),
  last_at: z.string(),
});
const submitSchema = z.object({ status: z.enum(["ok", "not_opted_in", "too_short", "low_accuracy", "implausible", "rate_limited"]) });
const nicknameSchema = z.object({ status: z.enum(["ok", "length", "chars", "blocked", "taken"]) });

/** Leaderboard over the Supabase view and RPCs in 20261117000002_leaderboard.sql. */
export function createSupabaseLeaderboard(client: SupabaseClient): LeaderboardRepository {
  return {
    async weekly() {
      const { data, error } = await client.from("leaderboard_weekly").select("rank,nickname,points,words,last_at").order("rank").limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []).flatMap((r) => {
        const p = rowSchema.safeParse(r);
        return p.success ? [{ rank: p.data.rank, nickname: p.data.nickname, points: p.data.points, words: p.data.words, lastAt: p.data.last_at }] : [];
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
        p_points: Math.round(score.points),
        p_correct: Math.round(score.correct),
        p_total: Math.round(score.total),
        p_duration_s: Math.round(score.durationS),
      });
      if (error) return "error";
      const s = submitSchema.safeParse(data);
      return s.success ? s.data.status : "error";
    },
  };
}
