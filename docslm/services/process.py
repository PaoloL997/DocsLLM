from pathlib import Path
from duckling.convert import DucklingGeneric


class Process:
    def __init__(self):
        self.duckling = DucklingGeneric()

    def process(self, paths: list):
        out = []
        for path in paths:
            filename = Path(path).stem
            docs = self.duckling.convert(
                path,
                namespace=filename,
            )
            out.extend(docs)
        return out
