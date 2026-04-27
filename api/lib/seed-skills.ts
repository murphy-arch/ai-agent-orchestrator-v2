import { getDb } from "@db/connection";
import { skills } from "@db/schema";

const DEFAULT_SKILLS = [
  // ─── Technical ───
  { slug: "python", name: "Python", category: "technical" as const, subcategory: "programming", difficulty: 2, popularity: 95 },
  { slug: "javascript", name: "JavaScript", category: "technical" as const, subcategory: "programming", difficulty: 2, popularity: 95 },
  { slug: "typescript", name: "TypeScript", category: "technical" as const, subcategory: "programming", difficulty: 3, popularity: 90 },
  { slug: "sql", name: "SQL", category: "technical" as const, subcategory: "data", difficulty: 2, popularity: 92 },
  { slug: "api-design", name: "API Design", category: "technical" as const, subcategory: "programming", difficulty: 3, popularity: 80 },
  { slug: "system-design", name: "System Design", category: "technical" as const, subcategory: "programming", difficulty: 4, popularity: 78 },
  { slug: "code-review", name: "Code Review", category: "technical" as const, subcategory: "programming", difficulty: 3, popularity: 82 },
  { slug: "debugging", name: "Debugging", category: "technical" as const, subcategory: "programming", difficulty: 3, popularity: 88 },
  { slug: "git", name: "Git", category: "technical" as const, subcategory: "programming", difficulty: 2, popularity: 90 },
  { slug: "testing", name: "Testing (Unit/E2E)", category: "technical" as const, subcategory: "programming", difficulty: 3, popularity: 85 },
  { slug: "docker", name: "Docker", category: "technical" as const, subcategory: "devops", difficulty: 3, popularity: 86 },
  { slug: "kubernetes", name: "Kubernetes", category: "technical" as const, subcategory: "devops", difficulty: 4, popularity: 78 },
  { slug: "aws", name: "AWS", category: "technical" as const, subcategory: "cloud", difficulty: 3, popularity: 88 },
  { slug: "azure", name: "Azure", category: "technical" as const, subcategory: "cloud", difficulty: 3, popularity: 72 },
  { slug: "gcp", name: "Google Cloud", category: "technical" as const, subcategory: "cloud", difficulty: 3, popularity: 68 },
  { slug: "terraform", name: "Terraform", category: "technical" as const, subcategory: "devops", difficulty: 3, popularity: 70 },
  { slug: "ci-cd", name: "CI/CD Pipelines", category: "technical" as const, subcategory: "devops", difficulty: 3, popularity: 80 },
  { slug: "linux", name: "Linux Administration", category: "technical" as const, subcategory: "devops", difficulty: 3, popularity: 82 },
  { slug: "monitoring", name: "Monitoring & Observability", category: "technical" as const, subcategory: "devops", difficulty: 3, popularity: 75 },
  { slug: "pandas", name: "Python Pandas", category: "technical" as const, subcategory: "data", difficulty: 2, popularity: 82 },
  { slug: "statistics", name: "Statistics", category: "technical" as const, subcategory: "data", difficulty: 3, popularity: 78 },
  { slug: "data-visualization", name: "Data Visualization", category: "technical" as const, subcategory: "data", difficulty: 2, popularity: 80 },
  { slug: "machine-learning", name: "Machine Learning", category: "technical" as const, subcategory: "data", difficulty: 4, popularity: 85 },
  { slug: "excel", name: "Excel / Google Sheets", category: "technical" as const, subcategory: "data", difficulty: 1, popularity: 90 },
  { slug: "figma", name: "Figma", category: "technical" as const, subcategory: "design", difficulty: 2, popularity: 84 },
  { slug: "wireframing", name: "Wireframing", category: "technical" as const, subcategory: "design", difficulty: 2, popularity: 78 },
  { slug: "prototyping", name: "Prototyping", category: "technical" as const, subcategory: "design", difficulty: 2, popularity: 80 },
  { slug: "design-systems", name: "Design Systems", category: "technical" as const, subcategory: "design", difficulty: 3, popularity: 72 },
  { slug: "accessibility", name: "Accessibility (WCAG)", category: "technical" as const, subcategory: "design", difficulty: 3, popularity: 68 },
  { slug: "usability-testing", name: "Usability Testing", category: "technical" as const, subcategory: "design", difficulty: 2, popularity: 70 },
  { slug: "user-research", name: "User Research", category: "technical" as const, subcategory: "design", difficulty: 2, popularity: 74 },
  { slug: "networking", name: "Computer Networking", category: "technical" as const, subcategory: "infrastructure", difficulty: 3, popularity: 72 },
  { slug: "security", name: "Cybersecurity", category: "technical" as const, subcategory: "infrastructure", difficulty: 4, popularity: 82 },
  { slug: "database-design", name: "Database Design", category: "technical" as const, subcategory: "data", difficulty: 3, popularity: 80 },

  // ─── Soft Skills ───
  { slug: "active-listening", name: "Active Listening", category: "soft" as const, subcategory: "communication", difficulty: 1, popularity: 88 },
  { slug: "empathy", name: "Empathy", category: "soft" as const, subcategory: "communication", difficulty: 1, popularity: 86 },
  { slug: "problem-solving", name: "Problem Solving", category: "soft" as const, subcategory: "cognitive", difficulty: 2, popularity: 92 },
  { slug: "critical-thinking", name: "Critical Thinking", category: "soft" as const, subcategory: "cognitive", difficulty: 2, popularity: 90 },
  { slug: "negotiation", name: "Negotiation", category: "soft" as const, subcategory: "communication", difficulty: 3, popularity: 78 },
  { slug: "stakeholder-communication", name: "Stakeholder Communication", category: "soft" as const, subcategory: "communication", difficulty: 3, popularity: 82 },
  { slug: "conflict-resolution", name: "Conflict Resolution", category: "soft" as const, subcategory: "communication", difficulty: 3, popularity: 76 },
  { slug: "storytelling", name: "Storytelling", category: "soft" as const, subcategory: "communication", difficulty: 2, popularity: 84 },
  { slug: "presentation", name: "Presentation Skills", category: "soft" as const, subcategory: "communication", difficulty: 2, popularity: 85 },
  { slug: "time-management", name: "Time Management", category: "soft" as const, subcategory: "productivity", difficulty: 1, popularity: 88 },
  { slug: "adaptability", name: "Adaptability", category: "soft" as const, subcategory: "cognitive", difficulty: 2, popularity: 86 },
  { slug: "leadership", name: "Leadership", category: "soft" as const, subcategory: "management", difficulty: 3, popularity: 88 },
  { slug: "mentoring", name: "Mentoring", category: "soft" as const, subcategory: "management", difficulty: 2, popularity: 76 },
  { slug: "collaboration", name: "Collaboration", category: "soft" as const, subcategory: "teamwork", difficulty: 1, popularity: 90 },
  { slug: "creativity", name: "Creativity", category: "soft" as const, subcategory: "cognitive", difficulty: 2, popularity: 86 },

  // ─── Domain ───
  { slug: "seo", name: "SEO", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 88 },
  { slug: "copywriting", name: "Copywriting", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 90 },
  { slug: "brand-voice", name: "Brand Voice", category: "domain" as const, subcategory: "marketing", difficulty: 3, popularity: 78 },
  { slug: "audience-analysis", name: "Audience Analysis", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 80 },
  { slug: "content-strategy", name: "Content Strategy", category: "domain" as const, subcategory: "marketing", difficulty: 3, popularity: 82 },
  { slug: "social-media", name: "Social Media Marketing", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 86 },
  { slug: "email-marketing", name: "Email Marketing", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 82 },
  { slug: "product-knowledge", name: "Product Knowledge", category: "domain" as const, subcategory: "support", difficulty: 2, popularity: 84 },
  { slug: "de-escalation", name: "De-escalation", category: "domain" as const, subcategory: "support", difficulty: 2, popularity: 78 },
  { slug: "prospecting", name: "Prospecting", category: "domain" as const, subcategory: "sales", difficulty: 2, popularity: 80 },
  { slug: "cold-outreach", name: "Cold Outreach", category: "domain" as const, subcategory: "sales", difficulty: 2, popularity: 78 },
  { slug: "objection-handling", name: "Objection Handling", category: "domain" as const, subcategory: "sales", difficulty: 3, popularity: 80 },
  { slug: "relationship-building", name: "Relationship Building", category: "domain" as const, subcategory: "sales", difficulty: 2, popularity: 82 },
  { slug: "agile-scrum", name: "Agile / Scrum", category: "domain" as const, subcategory: "management", difficulty: 2, popularity: 86 },
  { slug: "risk-management", name: "Risk Management", category: "domain" as const, subcategory: "management", difficulty: 3, popularity: 80 },
  { slug: "scheduling", name: "Scheduling & Planning", category: "domain" as const, subcategory: "management", difficulty: 2, popularity: 84 },
  { slug: "budgeting", name: "Budgeting", category: "domain" as const, subcategory: "management", difficulty: 3, popularity: 76 },
  { slug: "legal-research", name: "Legal Research", category: "domain" as const, subcategory: "legal", difficulty: 3, popularity: 72 },
  { slug: "contract-analysis", name: "Contract Analysis", category: "domain" as const, subcategory: "legal", difficulty: 3, popularity: 74 },
  { slug: "compliance", name: "Compliance", category: "domain" as const, subcategory: "legal", difficulty: 3, popularity: 78 },
  { slug: "risk-assessment", name: "Risk Assessment", category: "domain" as const, subcategory: "legal", difficulty: 3, popularity: 76 },
  { slug: "scientific-writing", name: "Scientific Writing", category: "domain" as const, subcategory: "research", difficulty: 3, popularity: 72 },
  { slug: "literature-review", name: "Literature Review", category: "domain" as const, subcategory: "research", difficulty: 3, popularity: 74 },
  { slug: "experimental-design", name: "Experimental Design", category: "domain" as const, subcategory: "research", difficulty: 4, popularity: 68 },
  { slug: "statistical-analysis", name: "Statistical Analysis", category: "domain" as const, subcategory: "research", difficulty: 4, popularity: 72 },
  { slug: "hypothesis-testing", name: "Hypothesis Testing", category: "domain" as const, subcategory: "research", difficulty: 3, popularity: 70 },
  { slug: "financial-modeling", name: "Financial Modeling", category: "domain" as const, subcategory: "finance", difficulty: 4, popularity: 76 },
  { slug: "accounting", name: "Accounting", category: "domain" as const, subcategory: "finance", difficulty: 3, popularity: 74 },
  { slug: "market-research", name: "Market Research", category: "domain" as const, subcategory: "marketing", difficulty: 2, popularity: 82 },

  // ─── Tools ───
  { slug: "crm-tools", name: "CRM Tools (Salesforce, HubSpot)", category: "tool" as const, subcategory: "sales", difficulty: 2, popularity: 86 },
  { slug: "jira", name: "Jira / Asana", category: "tool" as const, subcategory: "management", difficulty: 2, popularity: 84 },
  { slug: "slack", name: "Slack / Teams", category: "tool" as const, subcategory: "communication", difficulty: 1, popularity: 90 },
  { slug: "notion", name: "Notion / Confluence", category: "tool" as const, subcategory: "productivity", difficulty: 1, popularity: 86 },
  { slug: "zapier", name: "Zapier / Make", category: "tool" as const, subcategory: "automation", difficulty: 2, popularity: 78 },
  { slug: "github", name: "GitHub / GitLab", category: "tool" as const, subcategory: "programming", difficulty: 2, popularity: 88 },
  { slug: "vscode", name: "VS Code", category: "tool" as const, subcategory: "programming", difficulty: 1, popularity: 92 },
  { slug: "postman", name: "Postman / API Testing", category: "tool" as const, subcategory: "programming", difficulty: 2, popularity: 80 },
  { slug: "tableau", name: "Tableau / Power BI", category: "tool" as const, subcategory: "data", difficulty: 3, popularity: 78 },
  { slug: "photoshop", name: "Photoshop / Illustrator", category: "tool" as const, subcategory: "design", difficulty: 3, popularity: 80 },
  { slug: "wordpress", name: "WordPress / CMS", category: "tool" as const, subcategory: "marketing", difficulty: 2, popularity: 82 },
  { slug: "shopify", name: "Shopify / E-commerce", category: "tool" as const, subcategory: "marketing", difficulty: 2, popularity: 78 },
];

export async function seedSkills() {
  const db = getDb();

  const existing = await db.select().from(skills).limit(1);
  if (existing.length > 0) {
    console.log("[seed-skills] Skills already seeded. Skipping.");
    return;
  }

  for (const skill of DEFAULT_SKILLS) {
    await db.insert(skills).values({
      slug: skill.slug,
      name: skill.name,
      description: null,
      category: skill.category,
      subcategory: skill.subcategory ?? null,
      difficulty: skill.difficulty,
      prerequisites: [],
      relatedSkills: [],
      popularity: skill.popularity,
      isActive: true,
    });
  }

  console.log(`[seed-skills] Seeded ${DEFAULT_SKILLS.length} default skills.`);
}
