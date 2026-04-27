import type { CronSelection } from "./cron-builder";

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  cron: CronSelection;
  inputMessage: string;
  category: string;
}

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "daily-standup",
    name: "Daily Standup Summary",
    description: "Automatically generate a standup summary every weekday morning.",
    cron: { hour12: 9, minute: 0, ampm: "am", frequency: "weekly", weeklyDays: [1, 2, 3, 4, 5], monthlyDays: [] },
    inputMessage:
      "Review yesterday's workflow execution history and agent outputs. Summarize what was accomplished, highlight any failures or anomalies, and suggest today's priorities.",
    category: "operations",
  },
  {
    id: "weekly-report",
    name: "Weekly Analytics Report",
    description: "A comprehensive weekly report every Monday morning.",
    cron: { hour12: 8, minute: 0, ampm: "am", frequency: "weekly", weeklyDays: [1], monthlyDays: [] },
    inputMessage:
      "Generate a comprehensive weekly analytics report. Cover: total workflow executions, agent activity breakdown, token usage and estimated costs, success vs failure rates, and top-performing agents. Include trends and recommendations.",
    category: "analytics",
  },
  {
    id: "social-media",
    name: "Daily Social Media Post",
    description: "Draft a social media post every morning.",
    cron: { hour12: 10, minute: 0, ampm: "am", frequency: "daily", weeklyDays: [], monthlyDays: [] },
    inputMessage:
      "Draft an engaging social media post for today. Choose from: a product tip, an industry insight, a customer success story angle, or a thought-leadership question. Keep it under 280 characters with relevant hashtags.",
    category: "marketing",
  },
  {
    id: "code-review",
    name: "Code Review Digest",
    description: "End-of-day code quality and security review on weekdays.",
    cron: { hour12: 4, minute: 0, ampm: "pm", frequency: "weekly", weeklyDays: [1, 2, 3, 4, 5], monthlyDays: [] },
    inputMessage:
      "Review today's code commits and pull requests. Identify potential bugs, security vulnerabilities, performance issues, and style violations. Summarize findings with severity ratings and suggested fixes.",
    category: "engineering",
  },
  {
    id: "feedback-weekly",
    name: "Customer Feedback Weekly",
    description: "Friday afternoon digest of customer conversation themes.",
    cron: { hour12: 5, minute: 0, ampm: "pm", frequency: "weekly", weeklyDays: [5], monthlyDays: [] },
    inputMessage:
      "Analyze this week's customer support conversations and feedback. Summarize the top 5 themes, overall sentiment, most requested features, and urgent issues requiring immediate attention. Include actionable recommendations.",
    category: "support",
  },
  {
    id: "content-audit",
    name: "Monthly Content Audit",
    description: "First of the month knowledge base review.",
    cron: { hour12: 9, minute: 0, ampm: "am", frequency: "monthly", weeklyDays: [], monthlyDays: [1] },
    inputMessage:
      "Audit our knowledge base and content library. Identify outdated articles, missing topics based on recent customer questions, and content gaps. Produce a prioritized refresh list with suggested updates.",
    category: "content",
  },
  {
    id: "sales-brief",
    name: "Sales Pipeline Morning Brief",
    description: "Weekday morning sales pipeline status and follow-ups.",
    cron: { hour12: 8, minute: 0, ampm: "am", frequency: "weekly", weeklyDays: [1, 2, 3, 4, 5], monthlyDays: [] },
    inputMessage:
      "Review the sales pipeline status. Identify at-risk deals, stalled opportunities, and leads requiring follow-up. Draft personalized follow-up messages for the top 3 stalled deals and flag any urgent actions.",
    category: "sales",
  },
  {
    id: "security-review",
    name: "Security Log Daily Review",
    description: "Midnight security log anomaly scan.",
    cron: { hour12: 12, minute: 0, ampm: "am", frequency: "daily", weeklyDays: [], monthlyDays: [] },
    inputMessage:
      "Review today's system and application logs for security anomalies. Look for: failed authentication attempts, unusual access patterns, error spikes, and suspicious API activity. Report any critical findings immediately.",
    category: "engineering",
  },
  {
    id: "monday-motivation",
    name: "Monday Team Motivation",
    description: "Kick off the week with a motivational message.",
    cron: { hour12: 9, minute: 0, ampm: "am", frequency: "weekly", weeklyDays: [1], monthlyDays: [] },
    inputMessage:
      "Generate a motivational Monday message for the team. Highlight last week's key wins, celebrate any milestones, and set an inspiring tone for the week ahead. Keep it warm, genuine, and under 150 words.",
    category: "operations",
  },
  {
    id: "market-research",
    name: "Wednesday Market Research",
    description: "Mid-week industry trends and competitor snapshot.",
    cron: { hour12: 2, minute: 0, ampm: "pm", frequency: "weekly", weeklyDays: [3], monthlyDays: [] },
    inputMessage:
      "Research the latest industry trends, competitor news, and market developments relevant to our business. Summarize 3 key insights, 1 emerging opportunity, and 1 potential threat. Keep it concise and actionable.",
    category: "research",
  },
];

export const SCHEDULE_CATEGORIES: Record<string, { label: string; color: string }> = {
  operations: { label: "Operations", color: "bg-blue-100 text-blue-700" },
  analytics: { label: "Analytics", color: "bg-cyan-100 text-cyan-700" },
  marketing: { label: "Marketing", color: "bg-pink-100 text-pink-700" },
  engineering: { label: "Engineering", color: "bg-orange-100 text-orange-700" },
  support: { label: "Support", color: "bg-green-100 text-green-700" },
  content: { label: "Content", color: "bg-purple-100 text-purple-700" },
  sales: { label: "Sales", color: "bg-amber-100 text-amber-700" },
  research: { label: "Research", color: "bg-teal-100 text-teal-700" },
};

export const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "America/New_York", label: "Eastern Time (ET) — New York" },
  { value: "America/Chicago", label: "Central Time (CT) — Chicago" },
  { value: "America/Denver", label: "Mountain Time (MT) — Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles" },
  { value: "America/Anchorage", label: "Alaska Time — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii Time — Honolulu" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) — London" },
  { value: "Europe/Paris", label: "Central European Time (CET) — Paris" },
  { value: "Europe/Berlin", label: "Central European Time (CET) — Berlin" },
  { value: "Europe/Moscow", label: "Moscow Time — Moscow" },
  { value: "Asia/Dubai", label: "Gulf Standard Time — Dubai" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST) — Mumbai" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST) — Shanghai" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST) — Tokyo" },
  { value: "Asia/Seoul", label: "Korea Standard Time (KST) — Seoul" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET) — Sydney" },
  { value: "Pacific/Auckland", label: "New Zealand Time (NZT) — Auckland" },
  { value: "America/Sao_Paulo", label: "Brasília Time — São Paulo" },
  { value: "Africa/Johannesburg", label: "South Africa Standard Time — Johannesburg" },
];
