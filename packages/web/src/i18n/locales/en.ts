// ============================================
// i18n/locales/en.ts — English locale
// ============================================

export default {
  // ─── AppHeader ───
  header: {
    brand: "Orchestrator",
    dashboard: "Dashboard",
    createTask: "Create Task",
    serverOnline: "Server Online",
    offline: "Offline",
    langSwitch: "中文",
  },

  // ─── PhaseCard ───
  phase: {
    retry: "retry",
    status: {
      PENDING: "Pending",
      IN_PROGRESS: "Running",
      SUCCESS: "Success",
      FAILED: "Failed",
      SKIPPED: "Skipped",
      APPROVED_BY_HUMAN: "Approved",
    },
  },

  // ─── PhaseDetailModal ───
  phaseDetail: {
    openAriaLabel: "View phase details for {phaseId}",
    dialogAriaLabel: "Phase details for {phaseId}",
    title: "Phase Details · {phaseId}",
    close: "Close",
    fields: {
      status: "Status",
      startedAt: "Started At",
      finishedAt: "Finished At",
      duration: "Duration",
      summary: "summary",
      errorSummary: "error_summary",
      readFiles: "read_files",
      changedFiles: "changed_files",
      commandsExecuted: "commands_executed",
      artifactPointers: "artifact_pointers",
      operationsTimeline: "operations",
    },
    timeline: {
      seq: "seq",
      target: "target",
      meta: "meta",
      redaction: "redaction",
      states: {
        STARTED: "STARTED",
        COMPLETED: "COMPLETED",
        FAILED: "FAILED",
      },
      opTypes: {
        "read.file": "read.file",
        "read.dir": "read.dir",
        "search.glob": "search.glob",
        "search.grep": "search.grep",
        "exec.command": "exec.command",
        "fs.edit": "fs.edit",
        "artifact.add": "artifact.add",
        "net.fetch": "net.fetch",
        "ai.context.query": "ai.context.query",
        "phase.note": "phase.note",
        unknown: "unknown",
      },
    },
    emptyText: "None",
    emptyList: "No records",
    notAvailable: "N/A",
    duration: {
      seconds: "{seconds}s",
      ms: "{minutes}m {seconds}s",
      hms: "{hours}h {minutes}m {seconds}s",
    },
  },

  // ─── PipelineGraph ───
  pipeline: {
    title: "Pipeline Phases",
    phaseDesc: {
      phase_0: "Tech Scout",
      phase_0r: "Human Review",
      phase_1: "Red Test / Impl",
      phase_2: "Test / Impl",
      phase_3: "QA / Impl",
      phase_4: "Quality Assurance",
      phase_5: "Refactor",
      phase_6: "Compliance Audit",
      phase_7: "Security Review",
      phase_8: "Perf Review",
      phase_9: "Dependency Guard",
      phase_10: "Release Gate",
    },
  },

  // ─── HumanReviewPanel ───
  review: {
    title: "Human Review Required",
    hint: "Pipeline is paused at {phaseId}. Please review the generated document and choose an action.",
    commentLabel: "Comment (optional)",
    commentPlaceholder: "If revising, describe what needs to change...",
    approve: "Approve",
    revise: "Revise",
  },

  // ─── BlackboardViewer ───
  blackboard: {
    title: "Blackboard",
    expand: "Expand",
    collapse: "Collapse",
    taskId: "Task ID",
    categoryMode: "Category / Mode",
    requirement: "Requirement",
    globalContext: "Global Context",
    relevantFiles: "Relevant Files",
    apiContracts: "API Contracts",
    criticalLogic: "Critical Logic",
    rawJson: "Raw JSON",
    show: "Show",
    hide: "Hide",
  },

  // ─── LogStream ───
  log: {
    title: "Live Logs",
    connected: "Connected",
    disconnected: "Disconnected",
    clear: "Clear",
    autoScroll: "Auto-scroll",
    on: "ON",
    off: "OFF",
    waiting: "Waiting for events...",
    repeatSuffix: " ×{count}",
  },

  // ─── Pipeline Status ───
  status: {
    IDLE: "Idle",
    RUNNING: "Running",
    PAUSED_FOR_REVIEW: "Paused for Review",
    COMPLETED: "Completed",
    FAILED: "Failed",
    ABORTED: "Aborted",
  },

  // ─── Dashboard ───
  dashboard: {
    title: "Pipeline Tasks",
    newTask: "+ New Task",
    loadingTasks: "Loading tasks...",
    noTasks: "No tasks yet",
    createFirst: "Create your first task",
    mode: "Mode",
    progress: "Progress",
    phaseLabel: "Phase",
    delete: "Delete",
    confirmDelete: "Confirm delete task {taskId}?",
    category: {
      A: "MODIFY",
      B: "ADD",
      C: "DELETE",
      D: "READ",
    },
  },

  // ─── TaskDetail ───
  detail: {
    loading: "Loading task...",
    backDashboard: "Back to Dashboard",
    back: "← Back",
    startPipeline: "Start Pipeline",
    abort: "Abort",
    category: "Category",
    mode: "Mode",
    progress: "Progress",
    created: "Created",
    requirement: "Requirement",
    confirmAbort: "Confirm abort pipeline?",
    category_A: "MODIFY",
    category_B: "ADD",
    category_C: "DELETE",
    category_D: "READ",
  },

  // ─── CreateTask ───
  create: {
    title: "Create New Task",
    requirementLabel: "Requirement",
    requirementPlaceholder: "Describe what you need...",
    categoryLabel: "Category",
    categoryA: "A - MODIFY (Bug fix / Logic change)",
    categoryB: "B - ADD (New feature)",
    categoryC: "C - DELETE (Remove feature)",
    categoryD: "D - READ (Query / Analysis)",
    modeLabel: "Mode",
    modeMini: "Mini",
    modeFast: "Fast",
    modeBalanced: "Balanced",
    modeComprehensive: "Comprehensive",
    modeHardening: "Hardening",
    projectPathLabel: "Project Path (optional)",
    projectPathPlaceholder: "/path/to/project (defaults to current directory)",
    browsePathBtn: "Browse",
    directoryBrowser: "Select Project Directory",
    currentPath: "Current Path",
    parentDirectory: "Parent Directory",
    selectDirectory: "Confirm",
    emptyDirectory: "This directory is empty",
    loadingDirectories: "Loading...",
    directoryLoadError: "Failed to load directory contents",
    cancel: "Cancel",
    creating: "Creating...",
    createTask: "Create Task",
  },

  // ─── SSE event messages ───
  sse: {
    pipelineStarted: "Pipeline started",
    phaseStarted: "Phase {phaseId} started — {description}",
    phaseCompleted: "Phase {phaseId} completed",
    phaseFailed: "Phase {phaseId} failed — {error}",
    gatePassed: "Gate passed — {phaseId}",
    gateFailed: "Gate failed — {phaseId}",
    arbitrationStarted: "Failure arbitration started — {phaseId}",
    arbitrationCompleted: "Failure arbitration completed — {phaseId} ({action})",
    arbitrationAutoActionApplied: "Arbitration action applied — {phaseId} ({action})",
    humanReviewRequired: "Waiting for human review — {phaseId}",
    humanReviewCompleted: "Human review completed — {phaseId}",
    circuitBreakerTriggered: "Circuit breaker triggered — {phaseId}",
    pipelineCompleted: "Pipeline completed",
    pipelineFailed: "Pipeline failed — {error}",
    pipelineAborted: "Pipeline aborted",
    blackboardUpdated: "Blackboard updated",
    code: {
      PIPELINE_GATE_FAILED: "Gate verification failed",
      ARB_STARTED: "Failure arbitration started",
      ARB_REQUEST_MORE_EVIDENCE: "More evidence is required before retry",
      ARB_RETRY_SAME_AGENT: "Retrying with the same agent",
      ARB_SWITCH_AGENT_APPLIED: "Agent switch strategy applied",
      ARB_RETRY_LIMIT_REACHED: "Retry limit reached",
      ARB_POLICY_BLOCKED: "Policy blocked. Pipeline stopped",
      ARB_DECISION_BLOCK: "Arbitration blocked the pipeline",
      ARB_HIGH_RISK_SWITCH: "High-risk switch requires human review",
      ARB_UNCERTAIN_MORE_EVIDENCE: "Uncertain result requires human review",
    },
  },

  // ─── Store error messages ───
  store: {
    fetchTasksFailed: "Failed to fetch task list",
    fetchDetailFailed: "Failed to fetch task detail",
    createTaskFailed: "Failed to create task",
    deleteTaskFailed: "Failed to delete task",
    startPipelineFailed: "Failed to start pipeline",
    abortPipelineFailed: "Failed to abort pipeline",
    submitReviewFailed: "Failed to submit review",
  },

  // ─── HTTP error messages ───
  http: {
    networkError: "Network error",
    requestFailed: "Request failed: {message}",
    parseFailed: "Response parse failed",
    statusFailed: "Request failed ({status})",
  },
};
