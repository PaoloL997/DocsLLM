import base64
import zipfile
import requests
import subprocess
import sys
from dotenv import load_dotenv
import os
from pathlib import Path
from langchain_core.documents import Document

load_dotenv()
SERVICE_URL = os.getenv("GCLOUD_SERVICE_URL")


def get_id_token() -> str:
    """Get an identity token using gcloud CLI."""
    gcloud_cmd = "gcloud.cmd" if sys.platform == "win32" else "gcloud"
    token = subprocess.check_output(
        [gcloud_cmd, "auth", "print-identity-token"]
    ).decode().strip()
    return token

def health_check() -> dict:
    """Check the health of the service."""
    token = get_id_token()
    resp = requests.get(
        f"{SERVICE_URL}/health",
        headers={"Authorization": f"Bearer {token}"}
    )
    resp.raise_for_status()
    return resp.json()

def convert(path: str):
    token = get_id_token()
    with open(path, "rb") as f:
        resp = requests.post(
            f"{SERVICE_URL}/convert",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": f}
        )
    resp.raise_for_status()
    return resp.json()

def _artifacts(base64_artifacts: str, outdir: str = ".") -> list:
    zip_data = base64.b64decode(base64_artifacts)
    os.makedirs(outdir, exist_ok=True)
    temp_zip_path = os.path.join(outdir, "temp_artifacts.zip")
    with open(temp_zip_path, "wb") as f:
        f.write(zip_data)
    with zipfile.ZipFile(temp_zip_path, "r") as zip_ref:
        zip_ref.extractall(outdir)
    os.remove(temp_zip_path)

def process_files(paths: list):
    out = []
    for filepath in paths:
        result = convert(filepath)
        if result["status"] != "success":
            print(f"Error processing {filepath}")
            continue
        for c in result["content"]["documents"]:
            out.append(Document(
                page_content=c["page_content"],
                metadata=c["metadata"]
            ))
        input = Path(result["content"]["input"]).stem
        _artifacts(result["artifacts"], outdir=os.path.join("media", input))
    return out