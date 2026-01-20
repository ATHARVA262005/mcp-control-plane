/**
 * Simulates an AI router or rule-based engine that determines the next steps
 * based on the workflow goal and current context.
 */

export class ContextRouter {
  /**
   * Determine the next tasks based on goal and context.
   * @param {string} goal 
   * @param {object} context 
   * @returns {Array<{type: string, name: string, input: object}>}
   */
  async route(goal, context) {
    // Simple mock logic for demonstration
    const tasks = [];

    if (goal.toLowerCase().includes('search')) {
      tasks.push({
        type: 'TOOL_CALL',
        name: 'search_web',
        input: { query: goal }
      });
    }

    // Default catch-all reasoning step if no tools match
    if (tasks.length === 0) {
      tasks.push({
        type: 'REASONING',
        name: 'analyze_request',
        input: { goal }
      });
    }

    return tasks;
  }
}

export const contextRouter = new ContextRouter();
