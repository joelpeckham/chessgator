export type FeedbackNotice = {
  id: string;
  title: string;
  body?: string | null;
  variant?: "default" | "destructive";
  dismissible?: boolean;
  busy?: boolean;
};
