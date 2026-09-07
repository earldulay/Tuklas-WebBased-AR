export type Role = "student" | "teacher";

export type ViewMode = "ar" | "fallback";

export type Stage = "Predict" | "Observe" | "Explain" | "Reflection";

export type Screen = "home" | "modules" | "detail" | "observe" | "explain" | "result" | "settings";

export interface LearningModule {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  quarter: string;
  time: string;
  task: string;
  predictions: {
    question: string;
    choices: string[];
  }[];
  observe: string;
  overview: string;
}

export interface ActivityRecord {
  id: string;
  role: Role;
  module: string;
  moduleId: string;
  mode: ViewMode;
  stage: Stage;
  text: string;
  createdAt: string;
  syncedAt?: string;
}

export type ProgressState = Record<string, Partial<Record<"prediction" | "observation" | "explanation" | "result", boolean>>>;

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  name: string;
  section: string | null;
  createdAt: string;
}
