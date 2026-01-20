# MCP Control Plane

A lean, production-inspired Control Plane for Model Context Protocol (MCP) tool execution. This system is designed for high reliability, crash recovery, and observability in environment-aware task execution.

**Note:** This is a control plane for managing execution lifecycles, not a tool marketplace or an autonomous agent framework.

## Architecture Overview

The system is built on a decoupled architecture to ensure separation of concerns between request handling, scheduling, and tool execution.

*   **API Layer:** Handles incoming workflow requests, validates input schemas, and persists the initial intent.
*   **Control Plane:** Manages the lifecycle of workflows. It is responsible for task decomposition (routing) and state transitions.
*   **Execution Plane:** Powered by Agenda.js, this layer handles the actual execution of tasks. It manages retries, concurrency limits, and interacts with the MCP Client.
*   **Data Layer:** MongoDB provides a persistent, document-based store for Workflows, Tasks, and immutable Audit Logs.

### Data Flow
1.  **Request:** A user submits a goal via the API.
2.  **Intent:** A `Workflow` document is created in `PENDING` state.
3.  **Scheduling:** The Control Plane creates a `Task` (linked to the Workflow) and schedules a job in the Execution Plane.
4.  **Execution:** A worker picks up the job, connects to the internal MCP Server, and executes the tool.
5.  **Completion:** Upon success or terminal failure, the `Task` and `Workflow` states are updated, and results are persisted.

## MCP Integration

This project implements a protocol-compliant MCP integration using the official `@modelcontextprotocol/sdk`.

*   **SDK:** Node.js SDK (Client and Server).
*   **Transport:** `stdio`. Tool execution happens via a spawned sub-process running the internal MCP server.
*   **Tools:** Tool execution is real and protocol-compliant. The system interacts with an internal MCP server process (`src/infrastructure/internalMcpServer.js`) that exposes a `search_web` tool.

## Execution Model

The system follows a strict state-machine for both Tasks and Workflows to ensure deterministic behavior.

### Lifecycle States
*   **Task:** `PENDING` → `RUNNING` → `COMPLETED` | `FAILED`
*   **Workflow:** `PENDING` → `RUNNING` → `COMPLETED` | `FAILED`

### Semantics
*   **At-Least-Once Execution:** The system guarantees that a task will be attempted at least once. If a worker crashes mid-execution, the job remains in the queue (or is retried) until a terminal state is reached.
*   **Idempotency Guards:** Before execution, the system checks for existing output or terminal states to prevent redundant side effects in most crash recovery scenarios.

## Reliability & Crash Recovery

Reliability is a first-class citizen in this implementation. The system is designed to recover gracefully from process crashes.

*   **Workflow Reconciliation:** The system includes a reconciliation mechanism that runs on every task update. It ensures that the parent `Workflow` state correctly reflects the aggregate state of its `Tasks`. If a system-wide failure occurs, restarting the process triggers Agenda to resume unfinished jobs, which then trigger reconciliation.
*   **Idempotency & Crash Guards:** Each task execution checks for existing `output` or a `COMPLETED` state before invoking the MCP tool. This prevents re-execution of logic that has already succeeded but failed to update the parent status.
*   **Retry Behavior:** Failed tasks are automatically retried via Agenda up to a configurable maximum (`maxRetries`).

## Observability & Auditability

The system maintains a high-fidelity audit trail for every significant event.

*   **Immutable Audit Logs:** Every state transition (`TASK_STARTED`, `TASK_COMPLETED`, `WORKFLOW_FAILED`, etc.) is recorded in an immutable `AuditLog` collection.
*   **Traceability:** All logs are indexed by `workflowId`. This acts as a `TraceId`, enabling full reconstruction of the execution path from request to completion.
*   **Structured Logging:** A centralized logger (`Winston`) provides console and file-based logs with execution context (e.g., `ExecID`).

## Known Tradeoffs & Limitations

This implementation prioritizes correctness and clarity over feature breadth.

*   **At-Least-Once execution:** The system does not guarantee exactly-once execution. Non-idempotent tools may be triggered multiple times if a crash occurs exactly between tool execution and state persistence.
*   **Internal Transport Bottleneck:** Using a single `stdio` transport to an internal server limits throughput to the IO speed of the parent/child process pipe.
*   **No Cross-Document Transactions:** While MongoDB is used, this lean version does not implement multi-document ACID transactions across Workflow and Task updates. State consistency is managed via reconciliation.
*   **Persistence Limits:** Large tool outputs (>16MB) are not supported due to BSON document size limits.
*   **Single-Node Scheduler:** The current Agenda configuration is optimized for a single-node deployment; horizontal scaling would require distributed lock management (sticky sessions/better locking).

## What Was Intentionally Out of Scope

To maintain focus on the core control plane logic, the following features were excluded:

*   **Authentication & Authorization:** The API is unauthenticated; it is assumed to be running in a trusted environment.
*   **Distributed Workers:** The execution plane runs in-process with the API/Control Plane.
*   **DAG-Based Workflows:** Workflows are currently linear (one-to-one or simple sequences). Complex dependency graphs are not implemented.
*   **Dynamic Tool Discovery:** The server tools are hardcoded in the internal server for predictability.
*   **Exactly-Once Semantics:** Achieving this would require much higher complexity (e.g., distributed consensus) which was beyond the scope of proving basic protocol correctness.
