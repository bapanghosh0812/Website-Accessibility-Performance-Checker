export type LighthouseCategory =
  | 'all'
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo'
  | 'security';

export type AuditMode = 'live' | 'demo';
export type AuditRunPhase = 'static' | 'lhr';

export type FlowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FresnelLore {
  name: string;
  pronunciation: string;
  origin: string;
  quote: string;
  explanation: string;
}

export interface RepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  isDemo?: boolean;
}

export interface AuditCommit {
  id: string;
  sha: string;
  fullSha: string;
  category: Exclude<LighthouseCategory, 'all'>;
  categoryLabel: string;
  securityContext?: string;
  securityPattern?: string;
  ruleId: string;
  ruleTitle?: string;
  impact?: string;
  lhrAuditTitle?: string;
  lhrDisplayValue?: string;
  lhrTargetSelector?: string;
  lhrAreaImproved?: string;
  title: string;
  commitMessage: string;
  summary: string;
  files: string[];
  additions: number;
  deletions: number;
  author: string;
  date: string;
  body: string;
  diff: string;
}

export interface TelemetryStep {
  index: number;
  phase: string;
  category: string;
  headline: string;
  narrative: string;
  commitId?: string | null;
  sha?: string;
  ruleId?: string;
}

export interface CategoryImprovedItem {
  id: string;
  label: string;
  focus?: string;
  improved: boolean;
  commitsCount: number;
  rules?: string[];
}

export interface AuditSession {
  id: string;
  interactionId: string;
  mode: AuditMode;
  runPhase: AuditRunPhase;
  categoriesImproved?: CategoryImprovedItem[];
  lhrMeta?: {
    lighthouseVersion: string;
    requestedUrl: string;
    fetchTime: string;
  } | null;
  status: 'in_progress' | 'completed';
  progressPercent: number;
  repo: RepoMetadata;
  branch: string;
  categories: string[];
  currentStep: TelemetryStep;
  steps: TelemetryStep[];
  totalSteps: number;
  commits: AuditCommit[];
  totalCommits: number;
  pr: PullRequestResult | null;
}

export interface PatchBundle {
  filename: string;
  selectedCount: number;
  patchContent: string;
  downloadUrl: string;
  instructions: {
    cloneCmd: string;
    branchCmd: string;
    applyAmCmd: string;
    applyDiffCmd: string;
    verifyCmd: string;
    pushCmd: string;
  };
}

export interface PullRequestResult {
  number: number;
  mode: AuditMode;
  runPhase?: AuditRunPhase;
  title: string;
  body?: string;
  url: string;
  compareUrl?: string;
  repoUrl: string;
  repoFullName: string;
  baseBranch: string;
  headBranch: string;
  patchFilename?: string;
  patchDownloadUrl?: string;
  terminalCommand?: string;
  shortTerminalCommand?: string;
  createdAt: string;
  selectedCommits: AuditCommit[];
  totalAdditions: number;
  totalDeletions: number;
  filesTouched: string[];
}

