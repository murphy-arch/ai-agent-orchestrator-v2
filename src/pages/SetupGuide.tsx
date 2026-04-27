import {
  Boxes,
  Bot,
  Workflow,
  Radio,
  MessageSquare,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SetupStep {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  linkText: string;
  linkHref: string;
}

const steps: SetupStep[] = [
  {
    number: 1,
    title: "Create your first stack",
    description:
      "A stack is an isolated environment for your AI agents. Create one to get started with your first project or workspace.",
    icon: <Boxes className="h-6 w-6 text-blue-600" />,
    linkText: "Go to Dashboard",
    linkHref: "/dashboard",
  },
  {
    number: 2,
    title: "Add an orchestrator agent",
    description:
      "Every stack needs at least one agent. Start with an orchestrator agent that can coordinate tasks and delegate work to other agents.",
    icon: <Bot className="h-6 w-6 text-purple-600" />,
    linkText: "Go to Agents",
    linkHref: "/agents",
  },
  {
    number: 3,
    title: "Design your workflow",
    description:
      "Use the visual workflow builder to connect your agents. Define how data flows between agents and how decisions are made.",
    icon: <Workflow className="h-6 w-6 text-green-600" />,
    linkText: "Go to Architecture",
    linkHref: "/architecture",
  },
  {
    number: 4,
    title: "Add input sources",
    description:
      "Connect external channels like webhooks, Telegram, Slack, or Discord to feed messages into your agent workflow.",
    icon: <Radio className="h-6 w-6 text-amber-600" />,
    linkText: "Go to Settings",
    linkHref: "/settings",
  },
  {
    number: 5,
    title: "Test with the global chat",
    description:
      "Use the floating chat widget to send messages to your orchestrator and see how your agents handle real conversations.",
    icon: <MessageSquare className="h-6 w-6 text-pink-600" />,
    linkText: "Open Chat",
    linkHref: "#",
  },
];

export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Getting Started</h1>
            <p className="text-xs text-gray-500">Set up your AI agent orchestrator in 5 steps</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Card */}
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50/50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Welcome to AI Agent Orchestrator</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            This platform lets you build multi-agent AI systems where specialized agents collaborate
            to handle complex tasks. Follow the steps below to get your first stack up and running.
          </p>
        </div>

        {/* Steps */}
        <div className="relative space-y-6">
          {/* Vertical connector line */}
          <div
            className="absolute left-6 top-10 bottom-10 w-px bg-gray-200"
            aria-hidden="true"
          />

          {steps.map((step) => (
            <div
              key={step.number}
              className="relative flex gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              {/* Step number / icon */}
              <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50">
                {step.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Step {step.number}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  {step.description}
                </p>
                <Link
                  to={step.linkHref}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  {step.linkText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Tips Card */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Pro Tips</h3>
          <ul className="mt-3 space-y-2.5">
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Start simple — one orchestrator and one worker agent is enough for most use cases.
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Use the global chat widget to iterate quickly on your agent prompts.
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              API keys are scoped per-stack, so different stacks can use different provider accounts.
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              Invite team members to collaborate on your stacks with role-based access control.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
