// Keyword maps used by the scoring model.
// Each entry is a list of strings to match (case-insensitive) against
// article title + summary.

export const TOOL_KEYWORDS: Record<string, string[]> = {
  ChatGPT:    ["chatgpt", "gpt-4", "gpt-5", "openai chat", "chat completion"],
  Claude:     ["claude", "anthropic model"],
  Gemini:     ["gemini", "bard", "google ai studio"],
  Copilot:    ["copilot", "github copilot", "microsoft copilot"],
  Cursor:     ["cursor", "cursor ide", "ai code editor"],
  Perplexity: ["perplexity"],
  Midjourney: ["midjourney", "image generation", "text-to-image"],
};

// Keywords that signal a topic is TECHNICAL in nature
export const TECHNICAL_KEYWORDS = [
  "api", "model weights", "fine-tuning", "inference", "benchmark",
  "parameter", "token", "context window", "architecture", "open-source",
  "open source", "hugging face", "pytorch", "transformer",
  "multimodal", "embedding", "rag", "retrieval", "latency", "throughput",
];

// Keywords that signal STRATEGIC / BUSINESS IMPACT content
export const STRATEGIC_KEYWORDS = [
  "raises", "funding", "valuation", "acquisition", "partnership",
  "enterprise", "regulation", "policy", "legislation", "market",
  "revenue", "competition", "disruption", "strategy", "workforce",
  "layoffs", "hiring", "executive", "ceo", "board",
];

// Keywords that signal LEGAL / COMPLIANCE / GOVERNANCE content
export const LEGAL_KEYWORDS = [
  "compliance", "regulation", "regulatory", "policy", "legislation",
  "law", "legal", "liability", "governance", "risk", "audit",
  "privacy", "data protection", "gdpr", "ccpa", "ferpa", "hipaa",
  "copyright", "intellectual property", "terms of service",
  "accountability", "transparency", "bias", "ethics", "rights",
  "lawsuit", "ruling", "court", "ban", "enforcement", "fine",
];

// Keywords that signal TOOL / PRODUCT LAUNCH content
export const TOOL_LAUNCH_KEYWORDS = [
  "launch", "launches", "released", "new tool", "new feature",
  "now available", "introduces", "unveiled", "available today",
  "plugin", "integration", "update", "upgrade",
];

// Keywords that signal BUILD / DEVELOPER content
export const BUILD_KEYWORDS = [
  "api", "sdk", "developer", "open source", "github", "code",
  "function calling", "tool use", "agent", "agentic", "workflow",
  "deploy", "build with", "assistant api", "fine-tune",
];

// Industry → keywords to boost articles for that industry
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Financial Services": [
    "finance", "fintech", "banking", "investment", "trading",
    "regulation", "compliance", "fraud", "risk", "insurance",
    "sec", "fdic", "wealth management",
  ],
  // Aliases for onboarding values (slugs)
  "financial-services": [
    "finance", "fintech", "banking", "investment", "trading",
    "regulation", "compliance", "fraud", "risk", "insurance",
    "sec", "fdic", "wealth management",
  ],
  "Technology / Software": [
    // Keeping this aligned with the onboarding "technology" value.
    "software", "saas", "platform", "api", "sdk", "dev", "developer",
    "cloud", "infrastructure", "engineering", "backend", "frontend",
    "data", "ml", "ai", "machine learning", "llm", "model",
  ],
  "technology": [
    "software", "saas", "platform", "api", "sdk", "dev", "developer",
    "cloud", "infrastructure", "engineering", "backend", "frontend",
    "data", "ml", "ai", "machine learning", "llm", "model",
  ],
  "Healthcare / Life Sciences": [
    "health", "healthcare", "medical", "clinical", "fda", "pharma",
    "drug discovery", "biotech", "patient", "diagnosis", "radiology",
    "ehr", "hipaa", "life sciences",
  ],
  "healthcare": [
    "health", "healthcare", "medical", "clinical", "fda", "pharma",
    "drug discovery", "biotech", "patient", "diagnosis", "radiology",
    "ehr", "hipaa", "life sciences",
  ],
  "Consulting / Professional Services": [
    "consulting", "advisory", "strategy", "professional services",
    "law", "legal", "accounting", "audit", "tax", "management consulting",
  ],
  "professional-services": [
    "consulting", "advisory", "strategy", "professional services",
    "law", "legal", "accounting", "audit", "tax", "management consulting",
    "compliance", "risk",
  ],
  "Media / Marketing / Creative": [
    "marketing", "advertising", "content", "creative", "media",
    "brand", "campaign", "social media", "seo", "copywriting",
    "image generation", "video", "design", "figma", "adobe",
    "entertainment", "film", "music", "streaming", "hollywood",
    "production", "studio", "animation", "visual", "generative art",
    "midjourney", "stable diffusion", "dall-e", "sora",
    "creator", "influencer", "content creation", "narrative",
    "intellectual property", "copyright", "licensing",
  ],
  "media": [
    "marketing", "advertising", "content", "creative", "media",
    "brand", "campaign", "social media", "seo", "copywriting",
    "image generation", "video", "design", "figma", "adobe",
    "entertainment", "film", "music", "streaming", "production",
    "studio", "animation", "visual", "generative art", "sora",
    "intellectual property", "copyright",
  ],
  "Education / Research": [
    "education", "university", "research", "academic", "students",
    "learning", "edtech", "curriculum", "tutoring", "paper", "arxiv",
    "higher education", "k-12", "school", "classroom", "faculty",
    "plagiarism", "academic integrity", "ferpa", "student data",
  ],
  "education": [
    "education", "university", "research", "academic", "students",
    "learning", "edtech", "curriculum", "tutoring", "paper", "arxiv",
    "higher education", "k-12", "school", "classroom", "faculty",
    "plagiarism", "academic integrity", "ferpa", "student data",
  ],
  "Retail / Consumer": [
    "retail", "ecommerce", "e-commerce", "consumer", "shopping",
    "recommendation", "personalization", "customer", "supply chain",
  ],
  "retail": [
    "retail", "ecommerce", "e-commerce", "consumer", "shopping",
    "recommendation", "personalization", "customer", "supply chain",
  ],
  "Government / Public Sector": [
    "government", "public sector", "federal", "policy", "regulation",
    "nonprofit", "ngo", "civic", "democracy", "national security",
  ],
  "government": [
    "government", "public sector", "federal", "policy", "regulation",
    "nonprofit", "ngo", "civic", "democracy", "national security",
  ],
  "Manufacturing / Industrial": [
    "manufacturing", "industrial", "robotics", "automation", "supply chain",
    "logistics", "energy", "hardware", "factory", "iot",
  ],
  "manufacturing": [
    "manufacturing", "industrial", "robotics", "automation", "supply chain",
    "logistics", "energy", "hardware", "factory", "iot",
  ],
  "Nonprofit / Social impact": [
    "nonprofit", "ngo", "foundation", "charity", "social impact",
    "community", "volunteer", "program", "grant", "impact",
  ],
  "nonprofit": [
    "nonprofit", "ngo", "foundation", "charity", "social impact",
    "community", "volunteer", "program", "grant", "impact",
  ],
};
