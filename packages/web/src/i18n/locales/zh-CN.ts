// ============================================
// i18n/locales/zh-CN.ts — 简体中文语言包
// ============================================

export default {
  // ─── AppHeader ───
  header: {
    brand: "Orchestrator",
    dashboard: "仪表盘",
    createTask: "创建任务",
    serverOnline: "服务在线",
    offline: "离线",
    langSwitch: "EN",
  },

  // ─── PhaseCard ───
  phase: {
    retry: "重试",
    status: {
      PENDING: "待执行",
      IN_PROGRESS: "运行中",
      SUCCESS: "成功",
      FAILED: "失败",
      SKIPPED: "已跳过",
      APPROVED_BY_HUMAN: "已批准",
    },
  },

  // ─── PhaseDetailModal ───
  phaseDetail: {
    openAriaLabel: "查看 {phaseId} 阶段详情",
    dialogAriaLabel: "{phaseId} 阶段详情",
    title: "阶段详情 · {phaseId}",
    close: "关闭",
    fields: {
      status: "状态",
      startedAt: "开始时间",
      finishedAt: "结束时间",
      duration: "耗时",
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
    emptyText: "暂无",
    emptyList: "暂无记录",
    notAvailable: "暂无",
    duration: {
      seconds: "{seconds} 秒",
      ms: "{minutes} 分 {seconds} 秒",
      hms: "{hours} 小时 {minutes} 分 {seconds} 秒",
    },
  },

  // ─── PipelineGraph ───
  pipeline: {
    title: "流水线阶段",
    phaseDesc: {
      phase_0: "Tech Scout",
      phase_0r: "人工审阅",
      phase_1: "红测 / 实现",
      phase_2: "测试 / 实现",
      phase_3: "QA / 实现",
      phase_4: "质量保障",
      phase_5: "重构",
      phase_6: "合规审计",
      phase_7: "安全审查",
      phase_8: "性能审查",
      phase_9: "依赖审查",
      phase_10: "发布门禁",
    },
  },

  // ─── HumanReviewPanel ───
  review: {
    title: "需要人工审阅",
    hint: "流水线已暂停在 {phaseId}。请审阅生成的文档并选择操作。",
    commentLabel: "备注（可选）",
    commentPlaceholder: "如需修改，请描述需要变更的内容...",
    approve: "批准",
    revise: "修改",
  },

  // ─── BlackboardViewer ───
  blackboard: {
    title: "黑板",
    expand: "展开",
    collapse: "折叠",
    taskId: "任务 ID",
    categoryMode: "类别 / 模式",
    requirement: "需求",
    globalContext: "全局上下文",
    relevantFiles: "相关文件",
    apiContracts: "API 契约",
    criticalLogic: "关键逻辑",
    rawJson: "原始 JSON",
    show: "显示",
    hide: "隐藏",
  },

  // ─── LogStream ───
  log: {
    title: "实时日志",
    connected: "已连接",
    disconnected: "已断开",
    clear: "清空",
    autoScroll: "自动滚动",
    on: "开",
    off: "关",
    waiting: "等待事件...",
    repeatSuffix: " ×{count}",
  },

  // ─── Pipeline Status ───
  status: {
    IDLE: "空闲",
    RUNNING: "运行中",
    PAUSED_FOR_REVIEW: "等待审阅",
    COMPLETED: "已完成",
    FAILED: "失败",
    ABORTED: "已中止",
  },

  // ─── Dashboard ───
  dashboard: {
    title: "流水线任务",
    newTask: "+ 新建任务",
    loadingTasks: "加载任务中...",
    noTasks: "暂无任务",
    createFirst: "创建你的第一个任务",
    mode: "模式",
    progress: "进度",
    phaseLabel: "阶段",
    delete: "删除",
    confirmDelete: "确认删除任务 {taskId}？",
    category: {
      A: "修改",
      B: "新增",
      C: "删除",
      D: "查询",
    },
  },

  // ─── TaskDetail ───
  detail: {
    loading: "加载任务中...",
    backDashboard: "返回仪表盘",
    back: "← 返回",
    startPipeline: "启动流水线",
    abort: "中止",
    category: "类别",
    mode: "模式",
    progress: "进度",
    created: "创建时间",
    requirement: "需求",
    confirmAbort: "确认中止流水线？",
    category_A: "修改",
    category_B: "新增",
    category_C: "删除",
    category_D: "查询",
  },

  // ─── CreateTask ───
  create: {
    title: "创建新任务",
    requirementLabel: "需求描述",
    requirementPlaceholder: "描述你的需求...",
    categoryLabel: "类别",
    categoryA: "A - 修改（Bug 修复 / 逻辑变更）",
    categoryB: "B - 新增（新功能）",
    categoryC: "C - 删除（移除功能）",
    categoryD: "D - 查询（查询 / 分析）",
    modeLabel: "模式",
    modeMini: "极简",
    modeFast: "快速",
    modeBalanced: "均衡",
    modeComprehensive: "全面",
    modeHardening: "加固",
    projectPathLabel: "项目路径（可选）",
    projectPathPlaceholder: "/path/to/project（默认当前目录）",
    browsePathBtn: "浏览",
    directoryBrowser: "选择项目目录",
    currentPath: "当前路径",
    parentDirectory: "上级目录",
    selectDirectory: "确认选择",
    emptyDirectory: "此目录为空",
    loadingDirectories: "加载中...",
    directoryLoadError: "无法加载目录内容",
    cancel: "取消",
    creating: "创建中...",
    createTask: "创建任务",
  },

  // ─── SSE event messages ───
  sse: {
    pipelineStarted: "流水线已启动",
    phaseStarted: "阶段 {phaseId} 开始 — {description}",
    phaseCompleted: "阶段 {phaseId} 完成",
    phaseFailed: "阶段 {phaseId} 失败 — {error}",
    gatePassed: "门禁通过 — {phaseId}",
    gateFailed: "门禁失败 — {phaseId}",
    arbitrationStarted: "失败仲裁已启动 — {phaseId}",
    arbitrationCompleted: "失败仲裁已完成 — {phaseId}（{action}）",
    arbitrationAutoActionApplied: "已应用仲裁动作 — {phaseId}（{action}）",
    humanReviewRequired: "等待人工审阅 — {phaseId}",
    humanReviewCompleted: "人工审阅完成 — {phaseId}",
    circuitBreakerTriggered: "熔断器触发 — {phaseId}",
    pipelineCompleted: "流水线已完成",
    pipelineFailed: "流水线失败 — {error}",
    pipelineAborted: "流水线已中止",
    blackboardUpdated: "黑板已更新",
    code: {
      PIPELINE_GATE_FAILED: "门禁校验失败",
      ARB_STARTED: "失败仲裁已启动",
      ARB_REQUEST_MORE_EVIDENCE: "需要补充更多证据后重试",
      ARB_RETRY_SAME_AGENT: "将重试当前代理",
      ARB_SWITCH_AGENT_APPLIED: "已切换代理策略",
      ARB_RETRY_LIMIT_REACHED: "已达到重试上限",
      ARB_POLICY_BLOCKED: "策略阻断，流水线已停止",
      ARB_DECISION_BLOCK: "仲裁判定阻断，流水线已停止",
      ARB_HIGH_RISK_SWITCH: "高风险切换，需人工审阅",
      ARB_UNCERTAIN_MORE_EVIDENCE: "结果不确定，需人工审阅",
    },
  },

  // ─── Store error messages ───
  store: {
    fetchTasksFailed: "获取任务列表失败",
    fetchDetailFailed: "获取任务详情失败",
    createTaskFailed: "创建任务失败",
    deleteTaskFailed: "删除任务失败",
    startPipelineFailed: "启动流水线失败",
    abortPipelineFailed: "中止流水线失败",
    submitReviewFailed: "提交审阅失败",
  },

  // ─── HTTP error messages ───
  http: {
    networkError: "网络错误",
    requestFailed: "请求失败: {message}",
    parseFailed: "响应解析失败",
    statusFailed: "请求失败 ({status})",
  },
};
