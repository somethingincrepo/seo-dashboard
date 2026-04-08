import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_REGISTRY } from "./tools/index";

export function getToolDefinitions(names: string[]): Anthropic.Messages.Tool[] {
  return names.map((name) => {
    const tool = TOOL_REGISTRY[name];
    if (!tool) throw new Error(`Tool not found in registry: ${name}`);
    return tool.definition;
  });
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const tool = TOOL_REGISTRY[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(input);
}
