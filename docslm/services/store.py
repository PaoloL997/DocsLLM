import json
import yaml
from pathlib import Path

from graphrag.store.store import (
    Store,
    list_collections,
    list_databases,
    create_database,
)

from duckling.graph import DucklingGraph

from langchain_core.documents import Document
from pymilvus import Collection, MilvusException, connections, db, utility

def _connect_milvus(uri: str) -> None:
    """Open a Milvus connection from a URI.

    Args:
        uri: Milvus URI, e.g. ``http://localhost:19530``.
    """
    host = uri.split('://')[1].split(':')[0]
    port = int(uri.split(':')[-1])
    connections.connect(host=host, port=port)


class ManageDB:
    """High-level wrapper for Milvus database and collection management."""

    def __init__(self, config: str) -> None:
        """Args:
            config: Absolute path to the YAML configuration file.
        """
        with open(config, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

    def list_databases(self) -> list:
        return list_databases(self.config['uri'])

    def list_collections(self, database: str) -> list:
        return list_collections(self.config['uri'], f"comm_{database}")

    def create_database(self, database: str) -> None:
        create_database(self.config['uri'], f"comm_{database}")

    def create_collection(
        self,
        database: str,
        collection: str,
        files: list | None = None,
    ) -> bool:
        """Create a Milvus collection, optionally seeding it with documents.

        Args:
            database: Commessa / job identifier (used as DB name prefix).
            collection: Collection name.
            files: Optional list of absolute file paths to process and index.

        Returns:
            True on success.

        Raises:
            RuntimeError: If Milvus raises an exception during creation.
        """
        uri = self.config['uri']
        db_name = f"comm_{database}"

        _connect_milvus(uri)

        if db_name not in db.list_database():
            db.create_database(db_name)
        db.using_database(db_name)

        if collection in utility.list_collections():
            return True

        store = Store(
            uri=uri,
            database=db_name,
            collection=collection,
            k=self.config.get('k', 4),
            embedding_model=self.config.get('embedding_model'),
        )

        placeholder = Document(
            page_content='__placeholder__',
            metadata={
                'namespace': '__init__',
                'name': '__init__',
                'path': 'N/A',
                'type': 'placeholder',
                'page_start': 'N/A',
                'page_end': 'N/A',
            },
        )

        try:
            store.add([placeholder])
            coll = Collection(collection)
            coll.flush()
            coll.load()
            coll.delete(expr='namespace == "__init__"')
            coll.flush()

            if files:
                coll.set_properties({'files': json.dumps(files)})
            coll.release()

            if files:
                conv = DucklingGraph()
                print(f"Processing {len(files)} files...")
                for i, file in enumerate(files, 1):
                    print(f"Processing file {i}/{len(files)}: {file}")
                    filename = Path(file).stem
                    state = conv.run(file, namespace=filename)
                    chunks = state["documents"]
                    store.add(chunks)
                    coll = Collection(collection)
                    coll.flush()
                    coll.load()
                    print(f"Indexed {len(chunks)} documents from {file}.")
                    print(f"Finished processing {file}.")

        except MilvusException as exc:
            raise RuntimeError(f"Failed to create collection '{collection}': {exc}") from exc

        return True