from pathlib import Path
from duckling.graph import DucklingGraph


class Process:
    def __init__(self):
        self.duckling = DucklingGraph()

    def run(self, paths: list):
        out = []
        for path in paths:
            filename = Path(path).stem
            state = self.duckling.run(
                path,
                namespace=filename,
            )
            print(f"Processed {path}, produced {len(state['documents'])} documents.")
            docs = state["documents"]
            out.extend(docs)
        return out