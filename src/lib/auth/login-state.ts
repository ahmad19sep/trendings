export type LoginState = {
  status: "idle" | "error" | "configuration" | "rate-limited";
  message?: string;
};

export const initialLoginState: LoginState = { status: "idle" };

