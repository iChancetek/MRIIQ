"""
MCP Prior Authorization Server (mcp v2.x)
Exposes: get_patient(patient_id), get_rule()
"""
import json
import os
import sys
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp import types

# Resolve data dir relative to this file (mcp_server/server.py → data/)
DATA_DIR = Path(__file__).parent.parent / "data"

server = MCPServer(
    name="PriorAuthServer",
    version="1.0.0",
    description="MRI Prior Authorization MCP Server — provides patient and rule data.",
)


@server.tool(
    description="Return synthetic patient record by patient_id (e.g. P001, P002, P003)."
)
def get_patient(patient_id: str) -> dict:
    patients_file = DATA_DIR / "patients.json"
    with open(patients_file, "r") as f:
        patients = json.load(f)
    patient = patients.get(patient_id.upper())
    if patient is None:
        return {"error": f"Patient {patient_id} not found", "patient_id": patient_id}
    return patient


@server.tool(
    description="Return the MRI prior authorization clinical rule and required thresholds."
)
def get_rule() -> dict:
    rule_file = DATA_DIR / "rule.json"
    with open(rule_file, "r") as f:
        rule = json.load(f)
    return rule


if __name__ == "__main__":
    import asyncio
    asyncio.run(server.run_stdio_async())
