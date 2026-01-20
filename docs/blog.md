# The Art of Focus: Building a Lean MCP Control Plane

> **Philosophy:** One MCP tool. One Transport. One Execution Path. Anything else is scope creep.

---

## The "Zero Scope Creep" Manifesto

In the rush to build "autonomous agents," we often fall into the trap of over-engineering. We build generic plugin architectures, complex plugin discovery mechanisms, and dynamic layout systems before we've even successfully executed a single tool reliably.

If we can't make a single `search_web` call robust—handling context routing, persistence, retries, and auditing—we have no business adding a second one. This project implements **at-least-once execution semantics**, placing the burden of idempotency on the tools themselves.

## The Stack

- **Runtime**: Node.js (ES Modules)
- **Persistence**: MongoDB (Mongoose)
- **Execution**: Agenda.js (Persistent Job Queue)
- **Transport**: **Real MCP Protocol** (Stdio / JSON-RPC) via `@modelcontextprotocol/sdk`

## The Single Execution Path

The data flows in one direction. No spaghetti logic.

`Create workflow` → `Route Context` → `Persist Task` → `Execute (via Stdio Transport)` → `Audit Log`

### 1. The Context Router (The Brain)

We stripped the router down to its essence. It looks for intent and dispatches to the single available tool.

```javascript
// src/core/router.js
export class ContextRouter {
  async route(goal, context) {
    const tasks = [];
    
    // The One Tool
    if (goal.includes('search')) {
      tasks.push({ 
        type: 'TOOL_CALL', 
        name: 'search_web', 
        input: { query: goal } 
      });
    }

    return tasks; // Simple. Deterministic.
  }
}
```

### 2. The Protocol-Compliant Executor (The Muscle)

We don't just "mock" the tool execution anymore. We use the **Official MCP SDK** to spawn a child process and communicate via standard input/output.

```javascript
// src/core/mcpClient.js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async connect() {
  this.transport = new StdioClientTransport({
    command: "node",
    args: ["path/to/server.js"] // Spawns the tool server
  });

  this.client = new Client({ name: "control-plane" }, { capabilities: {} });
  await this.client.connect(this.transport);
}
```

This ensures that our Control Plane is strictly decoupled. We don't care *how* the tool works, only that it speaks the MCP Protocol.

### 3. The Evidence (Real Protocol Handshake)

We can see the actual JSON-RPC handshake occurring in the logs.

```text
[info]: [MCP] Connecting to Internal Server...
[info]: [MCP] Connected via Stdio Transport
[info]: [MCP] Available Tools: {"0":"search_web"}
[info]: [MCP] Requesting Tool Execution: search_web {"query":"Search for \"Model Context Protocol\""}
[info]: [MCP] Tool Response Received
```

### 4. Crash Awareness (Defensive Execution)

In distributed systems, networks fail and servers crash. A common failure mode is "Double Execution" where a task completes, the server crashes before state persistence, and the queue redelivers the job.

While we use `executionId` to track specific job attempts, correctness in this system is achieved via a combination of **task state management**, **persistent retries**, and **workflow reconciliation**. We don't guarantee exactly-once behavior; instead, we ensure that the system eventually converges to a terminal state.

```javascript
// src/jobs/index.js
defineJob('execute-task', async (job) => {
  const { taskId } = job.attrs.data;
  const task = await Task.findById(taskId);

  // CRASH GUARD: Defensive check against redundant execution
  if (task.status === 'COMPLETED') {
      logger.warn(`[CrashGuard] Task ${taskId} is already COMPLETED. Skipping.`);
      return;
  }
  
  // Reconciliation on job entry ensures the workflow state is still valid before execution proceeds.
  await reconcileWorkflow(task.workflowId);
  
  // ... execute tool ...
});
```

Because we provide **at-least-once semantics**, tools must be idempotent. Our control plane handles the persistent intent; the execution plane ensures the work is attempted until success or terminal failure.

### 5. Reconciliation Over Atomicity

Atomic cross-document transactions (e.g., updating a Task and its parent Workflow in one go) were intentionally avoided to minimize database overhead. Instead, we rely on **reconciliation as a convergence mechanism**.

Every time a task status changes, the system reconciles the entire workflow model. This ensures that the system eventually reaches a consistent terminal state (`COMPLETED` or `FAILED`) even if individual updates are interrupted by process crashes. It's a design choice that favors **eventual consistency** over complex distributed locking.

## System Output in Action

When we run our verification script, we see the system in action. This is real output from the production system:

```text
PS D:\Job\Atharva\Projects\mcp-control-plane> node verification_script.js
1. Checking Health...
Health: { status: 'ok', timestamp: '2026-01-20T20:07:16.340Z' }

2. Creating Workflow...
Workflow Created: {
  traceId: 'd5ea06c5-2bfd-4e39-8410-a5f1f83582fa',
  goal: 'Search for "Model Context Protocol"',
  status: 'RUNNING',
  _id: '696fe074c6e929fb3f349c0e'
}

3. Polling for completion...
[1] Status: RUNNING
Last Log: TASK_STARTED { taskId: '696fe074c6e929fb3f349c12', tool: 'search_web' }
[2] Status: COMPLETED
Last Log: WORKFLOW_COMPLETED { workflowId: '696fe074c6e929fb3f349c0e' }
```

By constraining the scope, we ensured that the **infrastructure** is correctness-focused.
- **Is it concurrency-aware?** Yes, MongoDB provides document-level consistency.
- **Is it persistent?** Yes, state survives restarts.
- **Is it observable?** Yes, full audit trails.


We built a tank, not a Ferrari. And a tank only needs one gun to be effective.

---

## 🏛️ Architecture Reality Check

To be transparent about the system's current maturity:

### ✅ What’s Real?
These are not mocks. They are correctness-focused implementations:
- **MCP Integration**: Uses the official `@modelcontextprotocol/sdk` over `stdio`. It's compatible with any spec-compliant MCP server.
- **Persistence**: Usage of `Agenda` backed by MongoDB means tasks survive server restarts.
- **Workflow Reconciliation**: Converges workflow state based on task outcomes, validated through crash-injection testing.
- **Audit Trails**: Every state change is immutably logged to the `AuditLog` collection.

### 🚫 What’s Intentionally Missing?
- **Authentication**: No API keys or OAuth. The system assumes it sits behind a gateway or VPC.
- **Exactly-Once Semantics**: Intentionally traded for simpler at-least-once semantics and idempotency requirements.
- **Cross-document Transactions**: Replaced by eventual consistency and reconciliation logic.
- **Atomic Task Claiming**: The current model allows for rare duplicate starts, handled by idempotency guards.
- **Complex DAGs**: The router currently produces linear or single-step plans.

> **Failure Model Summary**
> - **At-least-once execution**: Work is guaranteed to be attempted.
> - **Eventual consistency**: Achieved via persistent reconciliation.
> - **Deterministic failure propagation**: Task failures terminalize parent workflows.
> - **No zombie workflows**: State convergence ensures every intent reaches a result.

### 🚀 What I’d Do Next (With More Time)
1.  **Extract the Worker**: Split the `Agenda` worker into a separate microservice for independent scaling.
2.  **Redis-based Locking**: Replace MongoDB document-level consistency with Redis (Redlock) for higher throughput task claiming.
3.  **Topological Sort**: Upgrade the scheduler to handle dependency graphs (Task B waits for Task A).
4.  **mTLS for MCP**: Switch from `stdio` transport to `SSE` (Server-Sent Events) with mutual TLS for remote tool execution.
