"""
MCP Client — connects to the stdio MCP server and calls get_patient / get_rule.
"""
import asyncio
import json
import sys
from pathlib import Path

from mcp import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

# Absolute path to mcp_server/server.py
_SERVER_SCRIPT = str(Path(__file__).resolve().parent.parent.parent.parent / "mcp_server" / "server.py")
_PYTHON = sys.executable


async def _call_tool(tool_name: str, arguments: dict) -> dict:
    """Spin up the MCP stdio server, call one tool, return its result."""
    server_params = StdioServerParameters(
        command=_PYTHON,
        args=[_SERVER_SCRIPT],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            # result.content is a list of ToolResultContent
            if result.content:
                raw = result.content[0]
                if hasattr(raw, "text"):
                    try:
                        return json.loads(raw.text)
                    except json.JSONDecodeError:
                        return {"raw": raw.text}
            return {}


def get_patient(patient_id: str) -> dict:
    return asyncio.run(_call_tool("get_patient", {"patient_id": patient_id}))


def get_rule() -> dict:
    return asyncio.run(_call_tool("get_rule", {}))
