import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DailyRoutineStatus,
  Routine,
  RoutineId,
  RoutineLog,
  RoutineUpdate,
  UserProfile,
} from "../backend.d";
import { useActor } from "./useActor";

// ── User Profile ──────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// ── Routines ──────────────────────────────────────────────────────────────────

export function useGetAllRoutines() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Routine[]>({
    queryKey: ["routines"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllRoutines();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetDailyRoutinesWithStatus(date: string) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<DailyRoutineStatus[]>({
    queryKey: ["dailyRoutines", date],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDailyRoutinesWithStatus(date);
    },
    enabled: !!actor && !actorFetching && !!date,
    refetchInterval: 60 * 1000, // auto-refresh every 60 seconds
  });
}

export function useCreateRoutine() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description: string;
      scheduledTime: string;
      repeatDays: bigint[];
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createRoutine(
        params.name,
        params.description,
        params.scheduledTime,
        params.repeatDays,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["dailyRoutines"] });
    },
  });
}

export function useUpdateRoutine() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: RoutineId; updates: RoutineUpdate }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateRoutine(params.id, params.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["dailyRoutines"] });
    },
  });
}

export function useDeleteRoutine() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: RoutineId) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteRoutine(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["dailyRoutines"] });
    },
  });
}

export function useLogRoutine() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      routineId: RoutineId;
      date: string;
      status: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.logRoutine(params.routineId, params.date, params.status);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dailyRoutines"] });
      queryClient.invalidateQueries({
        queryKey: ["routineLogs", variables.routineId.toString()],
      });
    },
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export function useGetRoutineLogs(routineId: RoutineId | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<RoutineLog[]>({
    queryKey: ["routineLogs", routineId?.toString()],
    queryFn: async () => {
      if (!actor || routineId === null) return [];
      return actor.getRoutineLogs(routineId);
    },
    enabled: !!actor && !actorFetching && routineId !== null,
  });
}
