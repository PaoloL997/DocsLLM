from pathlib import Path
from duckling.graph import DucklingGraph


class Process:
    def __init__(self):
        self.duckling = DucklingGraph()

    def process(self, paths: list):
        out = []
        for path in paths:
            filename = Path(path).stem
            docs = self.duckling.run(
                path,
                namespace=filename,
            )
            out.extend(docs)
        return out
