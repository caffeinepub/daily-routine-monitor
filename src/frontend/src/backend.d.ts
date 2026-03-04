import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DailyRoutineStatus {
    status?: string;
    routine: Routine;
}
export type Timestamp = bigint;
export interface ReminderOffset {
    value: bigint;
    unit: string;
}
export interface RoutineUpdate {
    repeatDays?: Array<DayOfWeek>;
    scheduledTime?: string;
    name?: string;
    reminderEnabled?: boolean;
    description?: string;
    reminderOffset?: ReminderOffset;
}
export interface RoutineLog {
    id: LogId;
    status: string;
    date: string;
    routineId: RoutineId;
    loggedAt: Timestamp;
}
export type RoutineId = bigint;
export type DayOfWeek = bigint;
export interface Routine {
    id: RoutineId;
    repeatDays: Array<DayOfWeek>;
    scheduledTime: string;
    name: string;
    createdAt: Timestamp;
    reminderEnabled: boolean;
    description: string;
    reminderOffset: ReminderOffset;
}
export interface UserProfile {
    name: string;
}
export type LogId = bigint;
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createRoutine(name: string, description: string, scheduledTime: string, repeatDays: Array<DayOfWeek>, reminderEnabled: boolean, reminderOffset: ReminderOffset): Promise<RoutineId>;
    deleteRoutine(id: RoutineId): Promise<void>;
    getAllRoutines(): Promise<Array<Routine>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDailyRoutinesWithStatus(date: string): Promise<Array<DailyRoutineStatus>>;
    getRoutine(id: RoutineId): Promise<Routine | null>;
    getRoutineLogs(routineId: RoutineId): Promise<Array<RoutineLog>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    logRoutine(routineId: RoutineId, date: string, status: string): Promise<LogId>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateRoutine(id: RoutineId, updates: RoutineUpdate): Promise<void>;
    updateRoutineLogStatus(routineId: RoutineId, date: string, newStatus: string): Promise<void>;
}
