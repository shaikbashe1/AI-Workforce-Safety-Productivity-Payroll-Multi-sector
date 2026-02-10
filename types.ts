
export enum Sector {
  MINING = 'Mining',
  HARDWARE = 'Hardware',
  SOFTWARE = 'Software'
}

export enum WorkPermission {
  ALLOW = 'allow',
  DENY = 'deny'
}

export enum AdjustmentType {
  BONUS = 'bonus',
  NORMAL = 'normal',
  PENALTY = 'penalty',
  DENIED = 'denied'
}

export enum WorkStatus {
  FULL_DAY = 'full_day',
  HALF_DAY = 'half_day',
  DENIED = 'denied'
}

export enum RiskLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ActivityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NOT_PRESENT = 'not_present'
}

export enum WorkingStatus {
  WORKING = 'working',
  IDLE = 'idle',
  ABSENT = 'absent'
}

export interface PayrollInput {
  employee_id: string;
  sector: Sector;
  check_in_time: string;
  current_time: string;
  worker_image?: string; // base64
}

export interface PayrollOutput {
  employee_id: string;
  sector: string;
  authorized: boolean;
  human_detected: boolean;
  working_status: WorkingStatus;
  activity_level: ActivityLevel;
  helmet: boolean;
  vest: boolean;
  efficiency_percentage: number;
  risk_level: RiskLevel;
  hours_worked: number;
  hourly_rate: number;
  base_salary: number; // Added for internal calculation context
  final_salary: number;
  work_status: WorkStatus;
  confidence: number;
  explanation: string;
  timestamp: string;
}

export type AppTab = 'calculator' | 'admin';
