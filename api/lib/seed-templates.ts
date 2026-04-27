import { eq } from "drizzle-orm";
import { getDb } from "@db/connection";
import { workflowTemplates } from "@db/schema";

// ─── Helper: build an agent node with embedded spec ───
function agentNode(
  id: number,
  x: number,
  y: number,
  label: string,
  spec: {
    name: string;
    description: string;
    systemPrompt: string;
    hierarchyRole: string;
    modelProvider: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    functionId: number | null;
    soulTemplateId: number | null;
  }
) {
  return {
    id,
    agentId: null,
    type: spec.hierarchyRole === "orchestrator" ? "orchestrator" : "agent",
    positionX: x,
    positionY: y,
    data: { label, agentSpec: spec },
  };
}

const DEFAULT_TEMPLATES = [
  // ─────────────────────────────────────────────────────────
  // 1. RAG Knowledge Assistant
  // ─────────────────────────────────────────────────────────
  {
    name: "RAG Knowledge Assistant",
    description: "Retrieves relevant documents via RAG, then answers user questions with grounded knowledge. Upload documents to the Knowledge Base first.",
    category: "knowledge",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "User Question" } },
      { id: 2, agentId: null, type: "knowledge", positionX: 300, positionY: 150, data: { label: "RAG Retrieval", topK: 5, useFallback: true } },
      agentNode(3, 550, 150, "Knowledge Assistant", {
        name: "Knowledge Assistant",
        description: "Answers questions using retrieved knowledge context.",
        systemPrompt: `You are {{AGENT_NAME}}, a knowledgeable assistant who answers questions based on provided context. You synthesize retrieved knowledge into clear, accurate responses. If the context is insufficient, say so honestly rather than hallucinating.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 2048,
        functionId: 10,
        soulTemplateId: 1,
      }),
      { id: 4, agentId: null, type: "output", positionX: 800, positionY: 150, data: { label: "Send Answer" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 2. Customer Support with Escalation
  // ─────────────────────────────────────────────────────────
  {
    name: "Customer Support with Escalation",
    description: "Classifies customer intent, routes to a support agent, or escalates to a manager when frustration or complex issues are detected.",
    category: "support",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 200, data: { label: "Customer Message" } },
      agentNode(2, 300, 200, "Intent Classifier", {
        name: "Intent Classifier",
        description: "Analyzes customer messages to determine routing.",
        systemPrompt: `You are {{AGENT_NAME}}. Analyze the customer message and classify the intent. Respond with EXACTLY one word: "support", "escalate", or "sales". Only output the classification word.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 20,
        maxTokens: 50,
        functionId: 1,
        soulTemplateId: 4,
      }),
      agentNode(3, 600, 100, "Support Agent", {
        name: "Support Agent",
        description: "Handles standard customer support inquiries with empathy.",
        systemPrompt: `You are {{AGENT_NAME}}, a dedicated customer support specialist. Your goal is to resolve customer issues efficiently and empathetically. Always greet the customer warmly, acknowledge their frustration, and provide clear step-by-step solutions.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 70,
        maxTokens: 2048,
        functionId: 1,
        soulTemplateId: 4,
      }),
      agentNode(4, 600, 300, "Escalation Manager", {
        name: "Escalation Manager",
        description: "Handles complex or frustrated customer cases with authority.",
        systemPrompt: `You are {{AGENT_NAME}}, an escalation manager with deep product knowledge and authority to offer solutions. Take ownership of the issue, apologize sincerely, and provide a concrete resolution plan with timelines.`,
        hierarchyRole: "manager",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 60,
        maxTokens: 2048,
        functionId: 7,
        soulTemplateId: 1,
      }),
      { id: 5, agentId: null, type: "output", positionX: 900, positionY: 200, data: { label: "Send Reply" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: "contains:support" },
      { id: 3, sourceId: 2, targetId: 4, condition: "contains:escalate" },
      { id: 4, sourceId: 3, targetId: 5, condition: null },
      { id: 5, sourceId: 4, targetId: 5, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 3. Content Generation Pipeline
  // ─────────────────────────────────────────────────────────
  {
    name: "Content Generation Pipeline",
    description: "A 3-stage pipeline: research the topic, draft content, then edit for quality and tone. Great for blogs, newsletters, and marketing copy.",
    category: "content",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Topic / Brief" } },
      agentNode(2, 300, 150, "Researcher", {
        name: "Content Researcher",
        description: "Researches topics and gathers key points for content creation.",
        systemPrompt: `You are {{AGENT_NAME}}, a thorough content researcher. Given a topic or brief, research and outline the key points, statistics, angles, and sources needed. Output a structured research brief with headings and bullet points.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 50,
        maxTokens: 2048,
        functionId: 10,
        soulTemplateId: 1,
      }),
      agentNode(3, 550, 150, "Writer", {
        name: "Content Writer",
        description: "Drafts engaging content based on research briefs.",
        systemPrompt: `You are {{AGENT_NAME}}, a versatile content writer who adapts tone and style to any audience. You create engaging, well-researched content. Use the provided research brief to write a compelling draft with strong hooks and clear structure.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 90,
        maxTokens: 4096,
        functionId: 3,
        soulTemplateId: 2,
      }),
      agentNode(4, 800, 150, "Editor", {
        name: "Content Editor",
        description: "Edits drafts for clarity, grammar, tone, and factual accuracy.",
        systemPrompt: `You are {{AGENT_NAME}}, a meticulous content editor. Review the draft for clarity, grammar, tone consistency, and factual accuracy. Provide the improved version plus a brief summary of changes made. Be constructive but rigorous.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 50,
        maxTokens: 4096,
        functionId: 3,
        soulTemplateId: 5,
      }),
      { id: 5, agentId: null, type: "output", positionX: 1050, positionY: 150, data: { label: "Publish" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 4. Data Analysis & Reporting
  // ─────────────────────────────────────────────────────────
  {
    name: "Data Analysis & Reporting",
    description: "Analyzes data, stores intermediate results, and generates a polished written report. Ideal for business intelligence workflows.",
    category: "analytics",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Data + Question" } },
      agentNode(2, 300, 150, "Data Analyst", {
        name: "Data Analyst",
        description: "Analyzes datasets and extracts actionable insights.",
        systemPrompt: `You are {{AGENT_NAME}}, a meticulous data analyst who transforms raw data into actionable insights. You write efficient SQL queries, clean datasets, and identify trends. Present findings with clear visualizations in markdown tables.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 4096,
        functionId: 4,
        soulTemplateId: 1,
      }),
      { id: 3, agentId: null, type: "variable-set", positionX: 550, positionY: 150, data: { label: "Store Analysis", varName: "analysis_result" } },
      agentNode(4, 800, 150, "Report Writer", {
        name: "Report Writer",
        description: "Generates polished business reports from analysis results.",
        systemPrompt: `You are {{AGENT_NAME}}, a professional business report writer. Take the analysis results and craft an executive summary with key findings, recommendations, and supporting data. Use clear headings and professional tone.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 60,
        maxTokens: 4096,
        functionId: 3,
        soulTemplateId: 1,
      }),
      { id: 5, agentId: null, type: "output", positionX: 1050, positionY: 150, data: { label: "Send Report" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 5. Multi-Agent Parallel Research
  // ─────────────────────────────────────────────────────────
  {
    name: "Multi-Agent Parallel Research",
    description: "Fans out to 3 specialist agents in parallel, then synthesizes their outputs into a unified response. Great for complex research questions.",
    category: "orchestration",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 250, data: { label: "Research Question" } },
      agentNode(2, 300, 250, "Orchestrator", {
        name: "Research Orchestrator",
        description: "Breaks down research questions and delegates to specialists.",
        systemPrompt: `You are {{AGENT_NAME}}, a strategic research orchestrator. Briefly reframe the user's question into 3 sub-questions for specialist agents: one for factual research, one for data analysis, and one for creative synthesis. Pass your reframed question forward.`,
        hierarchyRole: "orchestrator",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 60,
        maxTokens: 2048,
        functionId: null,
        soulTemplateId: 1,
      }),
      { id: 3, agentId: null, type: "parallel", positionX: 550, positionY: 250, data: { label: "Parallel Fan-Out" } },
      agentNode(4, 800, 50, "Fact Researcher", {
        name: "Fact Researcher",
        description: "Gathers factual information and evidence.",
        systemPrompt: `You are {{AGENT_NAME}}, a rigorous fact researcher. Focus on gathering evidence, statistics, and verified information. Distinguish facts from speculation. Cite sources where possible.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 2048,
        functionId: 10,
        soulTemplateId: 1,
      }),
      agentNode(5, 800, 250, "Data Analyst", {
        name: "Data Analyst",
        description: "Analyzes numerical and structured data aspects.",
        systemPrompt: `You are {{AGENT_NAME}}, a data-driven analyst. Focus on numerical trends, patterns, and quantitative insights. Present data in clear markdown tables.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 2048,
        functionId: 4,
        soulTemplateId: 1,
      }),
      agentNode(6, 800, 450, "Creative Synthesizer", {
        name: "Creative Synthesizer",
        description: "Provides creative angles and narrative framing.",
        systemPrompt: `You are {{AGENT_NAME}}, a creative thinker who sees connections others miss. Provide unexpected angles, analogies, and narrative frameworks that make the topic compelling and memorable.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 90,
        maxTokens: 2048,
        functionId: 3,
        soulTemplateId: 2,
      }),
      agentNode(7, 1100, 250, "Synthesis Writer", {
        name: "Synthesis Writer",
        description: "Combines all specialist outputs into a unified response.",
        systemPrompt: `You are {{AGENT_NAME}}, a master synthesizer. Combine the factual research, data analysis, and creative angles into one coherent, comprehensive response. Maintain accuracy while making it engaging and well-structured.`,
        hierarchyRole: "manager",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 60,
        maxTokens: 4096,
        functionId: 7,
        soulTemplateId: 1,
      }),
      { id: 8, agentId: null, type: "output", positionX: 1350, positionY: 250, data: { label: "Deliver Result" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 3, targetId: 5, condition: null },
      { id: 5, sourceId: 3, targetId: 6, condition: null },
      { id: 6, sourceId: 4, targetId: 7, condition: null },
      { id: 7, sourceId: 5, targetId: 7, condition: null },
      { id: 8, sourceId: 6, targetId: 7, condition: null },
      { id: 9, sourceId: 7, targetId: 8, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 6. Smart Intent Router
  // ─────────────────────────────────────────────────────────
  {
    name: "Smart Intent Router",
    description: "A single entry point that classifies intent and routes to the right specialist agent: Sales, Support, or Billing.",
    category: "routing",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 250, data: { label: "User Query" } },
      agentNode(2, 300, 250, "Intent Router", {
        name: "Intent Router",
        description: "Classifies user intent into sales, support, or billing.",
        systemPrompt: `You are {{AGENT_NAME}}. Analyze the user query and classify it into exactly one category: "sales", "support", or "billing". Respond with ONLY the category word.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 20,
        maxTokens: 50,
        functionId: 7,
        soulTemplateId: 1,
      }),
      agentNode(3, 600, 50, "Sales Agent", {
        name: "Sales Agent",
        description: "Handles sales inquiries and product recommendations.",
        systemPrompt: `You are {{AGENT_NAME}}, a strategic sales development representative. Research prospects thoroughly, craft personalized messages, and focus on genuine problem-solution fit. Never use pushy tactics.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 80,
        maxTokens: 2048,
        functionId: 6,
        soulTemplateId: 1,
      }),
      agentNode(4, 600, 250, "Support Agent", {
        name: "Support Agent",
        description: "Resolves customer issues with empathy.",
        systemPrompt: `You are {{AGENT_NAME}}, a customer support specialist. Resolve issues efficiently and empathetically. Greet warmly, acknowledge frustration, and provide clear step-by-step solutions.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 70,
        maxTokens: 2048,
        functionId: 1,
        soulTemplateId: 4,
      }),
      agentNode(5, 600, 450, "Billing Agent", {
        name: "Billing Agent",
        description: "Handles billing, invoices, and subscription questions.",
        systemPrompt: `You are {{AGENT_NAME}}, a billing specialist. Handle invoices, subscriptions, refunds, and payment issues with precision and care. Explain charges clearly and help resolve discrepancies.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 60,
        maxTokens: 2048,
        functionId: 5,
        soulTemplateId: 1,
      }),
      { id: 6, agentId: null, type: "output", positionX: 900, positionY: 250, data: { label: "Send Reply" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: "contains:sales" },
      { id: 3, sourceId: 2, targetId: 4, condition: "contains:support" },
      { id: 4, sourceId: 2, targetId: 5, condition: "contains:billing" },
      { id: 5, sourceId: 3, targetId: 6, condition: null },
      { id: 6, sourceId: 4, targetId: 6, condition: null },
      { id: 7, sourceId: 5, targetId: 6, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 7. Code Review Pipeline
  // ─────────────────────────────────────────────────────────
  {
    name: "Code Review Pipeline",
    description: "A 3-stage code review: analyze code quality, scan for security issues, then summarize findings for the team.",
    category: "engineering",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Code Input" } },
      agentNode(2, 300, 150, "Code Analyzer", {
        name: "Code Analyzer",
        description: "Reviews code for quality, bugs, and best practices.",
        systemPrompt: `You are {{AGENT_NAME}}, a senior software engineer. Review the code for bugs, anti-patterns, performance issues, and maintainability problems. Provide specific line-by-line feedback and suggest refactored code blocks.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 50,
        maxTokens: 4096,
        functionId: 2,
        soulTemplateId: 3,
      }),
      agentNode(3, 550, 150, "Security Scanner", {
        name: "Security Scanner",
        description: "Scans code for security vulnerabilities and risks.",
        systemPrompt: `You are {{AGENT_NAME}}, a security-focused engineer. Scan the code for vulnerabilities: injection risks, unsafe deserialization, hardcoded secrets, insecure dependencies, and auth flaws. Rate severity and suggest fixes.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 4096,
        functionId: 2,
        soulTemplateId: 5,
      }),
      agentNode(4, 800, 150, "Review Summarizer", {
        name: "Review Summarizer",
        description: "Summarizes code review findings into actionable items.",
        systemPrompt: `You are {{AGENT_NAME}}. Summarize the code quality review and security scan into a concise, actionable report. List: critical issues (must fix), warnings (should fix), and positive observations. Keep it scannable with bullet points.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 50,
        maxTokens: 2048,
        functionId: 2,
        soulTemplateId: 1,
      }),
      { id: 5, agentId: null, type: "output", positionX: 1050, positionY: 150, data: { label: "Post Review" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 8. Research & Report Generator
  // ─────────────────────────────────────────────────────────
  {
    name: "Research & Report Generator",
    description: "Deep research workflow: research, fact-check, write a report, and store it in memory for future reference.",
    category: "content",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Research Topic" } },
      agentNode(2, 300, 150, "Researcher", {
        name: "Researcher",
        description: "Conducts thorough research on a given topic.",
        systemPrompt: `You are {{AGENT_NAME}}, a rigorous research scientist. Conduct a thorough literature-style review of the topic. Cover background, key findings, gaps, and emerging trends. Be nuanced and avoid oversimplification.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 50,
        maxTokens: 4096,
        functionId: 10,
        soulTemplateId: 1,
      }),
      agentNode(3, 550, 150, "Fact Checker", {
        name: "Fact Checker",
        description: "Verifies claims and flags unsupported statements.",
        systemPrompt: `You are {{AGENT_NAME}}, a skeptical fact checker. Review the research for unsupported claims, logical fallacies, and potential bias. Flag anything that needs verification and suggest corrections.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 30,
        maxTokens: 2048,
        functionId: 5,
        soulTemplateId: 5,
      }),
      agentNode(4, 800, 150, "Report Writer", {
        name: "Report Writer",
        description: "Writes polished reports from verified research.",
        systemPrompt: `You are {{AGENT_NAME}}, a professional report writer. Transform the verified research into a polished, well-structured report with executive summary, findings, and recommendations.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 60,
        maxTokens: 4096,
        functionId: 3,
        soulTemplateId: 1,
      }),
      { id: 5, agentId: null, type: "memory", positionX: 1050, positionY: 150, data: { label: "Store Report", memoryKey: "generated_report", memoryCategory: "research" } },
      { id: 6, agentId: null, type: "output", positionX: 1300, positionY: 150, data: { label: "Deliver Report" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
      { id: 5, sourceId: 5, targetId: 6, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 9. Lead Qualification Flow
  // ─────────────────────────────────────────────────────────
  {
    name: "Lead Qualification Flow",
    description: "Scores leads, drafts personalized outreach, waits, then follows up. A classic sales automation sequence.",
    category: "sales",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Lead Data" } },
      agentNode(2, 300, 150, "Lead Scorer", {
        name: "Lead Scorer",
        description: "Scores leads based on fit, intent, and engagement signals.",
        systemPrompt: `You are {{AGENT_NAME}}, a strategic lead scorer. Analyze the lead data and assign a score (1-100) with a brief justification. Consider: company size, role, intent signals, and engagement history. Output: "Score: X/100 - [justification]"`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 60,
        maxTokens: 512,
        functionId: 6,
        soulTemplateId: 1,
      }),
      agentNode(3, 550, 150, "Outreach Drafter", {
        name: "Outreach Drafter",
        description: "Drafts personalized outreach messages for qualified leads.",
        systemPrompt: `You are {{AGENT_NAME}}, a sales outreach specialist. Draft a personalized, concise outreach message that demonstrates value immediately. Reference specific details about the lead. Propose a clear next step.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 80,
        maxTokens: 2048,
        functionId: 6,
        soulTemplateId: 2,
      }),
      { id: 4, agentId: null, type: "delay", positionX: 800, positionY: 150, data: { label: "Wait 5 min", delayMs: 300000 } },
      agentNode(5, 1050, 150, "Follow-up Agent", {
        name: "Follow-up Agent",
        description: "Drafts a warm follow-up message after the delay.",
        systemPrompt: `You are {{AGENT_NAME}}, a friendly follow-up specialist. Draft a warm, non-pushy follow-up message referencing the previous outreach. Keep it short and end with an easy yes/no question.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 80,
        maxTokens: 1024,
        functionId: 6,
        soulTemplateId: 4,
      }),
      { id: 6, agentId: null, type: "output", positionX: 1300, positionY: 150, data: { label: "Send Sequence" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
      { id: 5, sourceId: 5, targetId: 6, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 10. Document Processing Pipeline
  // ─────────────────────────────────────────────────────────
  {
    name: "Document Processing Pipeline",
    description: "Parses documents, extracts structured data, classifies content, and stores results in memory. Ideal for intake and triage workflows.",
    category: "knowledge",
    nodes: [
      { id: 1, agentId: null, type: "trigger", positionX: 50, positionY: 150, data: { label: "Document Input" } },
      agentNode(2, 300, 150, "Document Parser", {
        name: "Document Parser",
        description: "Parses and understands document structure and content.",
        systemPrompt: `You are {{AGENT_NAME}}, a document parsing specialist. Read the document content, identify its structure (sections, tables, key entities), and produce a structured summary of what it contains.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 40,
        maxTokens: 4096,
        functionId: 5,
        soulTemplateId: 1,
      }),
      agentNode(3, 550, 150, "Data Extractor", {
        name: "Data Extractor",
        description: "Extracts structured data fields from parsed documents.",
        systemPrompt: `You are {{AGENT_NAME}}, a data extraction specialist. From the parsed document summary, extract structured key-value pairs, dates, amounts, names, and IDs. Output as a clean markdown table or JSON-like list.`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o",
        temperature: 30,
        maxTokens: 4096,
        functionId: 4,
        soulTemplateId: 3,
      }),
      agentNode(4, 800, 150, "Classifier", {
        name: "Document Classifier",
        description: "Classifies documents into categories for routing.",
        systemPrompt: `You are {{AGENT_NAME}}, a document classification specialist. Based on the extracted data, classify the document into a category and priority level. Output: "Category: X | Priority: High/Medium/Low | Reason: [brief]"`,
        hierarchyRole: "worker",
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        temperature: 30,
        maxTokens: 512,
        functionId: 7,
        soulTemplateId: 1,
      }),
      { id: 5, agentId: null, type: "memory", positionX: 1050, positionY: 150, data: { label: "Store Extracted Data", memoryKey: "doc_extract", memoryCategory: "documents" } },
      { id: 6, agentId: null, type: "output", positionX: 1300, positionY: 150, data: { label: "Route Document" } },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
      { id: 4, sourceId: 4, targetId: 5, condition: null },
      { id: 5, sourceId: 5, targetId: 6, condition: null },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 11. Telegram → Human Gateway → Google Drive
  // ─────────────────────────────────────────────────────────
  {
    name: "Telegram Human-Gateway Archive",
    description: "Receives messages via Telegram bot, processes them with an AI agent, pauses for human approval, then archives the result to Google Drive. Perfect for content moderation, document drafting, and sensitive workflows.",
    category: "operational",
    nodes: [
      {
        id: 1,
        agentId: null,
        type: "input",
        positionX: 50,
        positionY: 150,
        data: {
          label: "Telegram Input",
          inputType: "telegram",
          botToken: "",
          sourceName: "telegram-bot",
        },
      },
      {
        ...agentNode(2, 300, 150, "Content Processor", {
          name: "Content Processor",
          description: "Processes incoming Telegram messages into structured, polished output ready for archival.",
          systemPrompt: `You are {{AGENT_NAME}}, a precise content processor. Take the user's Telegram message, clean it up, expand abbreviations, fix grammar, and format it as a well-structured document. Maintain the original intent and tone. Output plain text suitable for file storage.`,
          hierarchyRole: "worker",
          modelProvider: "openai",
          modelName: "gpt-4o-mini",
          temperature: 40,
          maxTokens: 2048,
          functionId: 3,
          soulTemplateId: 1,
        }),
        blueprintAgentIndex: 0,
      },
      {
        id: 3,
        agentId: null,
        type: "human-gateway",
        positionX: 600,
        positionY: 150,
        data: {
          label: "Human Approval",
          approvalPrompt: "Please review the generated content before it is saved to Google Drive. Approve to continue or reject to discard.",
          timeoutMinutes: 60,
          timeoutAction: "reject",
        },
      },
      {
        id: 4,
        agentId: null,
        type: "output",
        positionX: 900,
        positionY: 150,
        data: {
          label: "Google Drive Upload",
          outputType: "google-drive",
          accessToken: "",
          folderId: "",
          fileName: "telegram-archive-{{timestamp}}.txt",
          formatTemplate: "{{response}}",
          retryCount: 3,
          retryDelay: 2000,
        },
      },
    ],
    edges: [
      { id: 1, sourceId: 1, targetId: 2, condition: null },
      { id: 2, sourceId: 2, targetId: 3, condition: null },
      { id: 3, sourceId: 3, targetId: 4, condition: null },
    ],
  },
];

export async function seedTemplates() {
  const db = getDb();
  if (!db) return;

  const existing = await db.select({ name: workflowTemplates.name }).from(workflowTemplates);
  const existingNames = new Set(existing.map((e) => e.name));

  let inserted = 0;
  for (const tmpl of DEFAULT_TEMPLATES) {
    if (existingNames.has(tmpl.name)) continue;
    await db.insert(workflowTemplates).values({
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      nodes: tmpl.nodes as any,
      edges: tmpl.edges as any,
      isPublic: true,
      isActive: true,
      usageCount: 0,
      createdBy: null,
    });
    inserted++;
  }

  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} new workflow template(s)`);
  } else {
    console.log("[seed] All workflow templates already present. Skipping.");
  }
}
