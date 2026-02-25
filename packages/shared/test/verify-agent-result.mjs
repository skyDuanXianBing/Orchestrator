import assert from "node:assert/strict";
import { parseAgentResult } from "../dist/index.js";

function run() {
  const ok = parseAgentResult(`{
    "status": "SUCCESS",
    "summary": "done",
    "changed_files": ["a.ts"],
    "commands_executed": ["pnpm test"],
    "artifact_pointers": ["logs/out.log"],
    "error_summary": null,
    "next_suggestion": null
  }`);

  assert.equal(ok.status, "SUCCESS");
  assert.equal(ok.changed_files.length, 1);

  const fenced = parseAgentResult("```json\n{\n\"status\":\"FAILED\",\n\"summary\":\"x\",\n\"changed_files\":[],\n\"commands_executed\":[],\n\"artifact_pointers\":[]\n}\n```");
  assert.equal(fenced.status, "FAILED");

  const fallback = parseAgentResult("not json");
  assert.equal(fallback.status, "FAILED");
  assert.ok(fallback.error_summary !== null);

  console.log("verify-agent-result: success");
}

run();
