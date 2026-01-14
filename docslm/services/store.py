import json
import yaml

from graphrag.store import (
    Store,
    list_collections,
    list_databases,
    create_database
)
from langchain_core.documents import Document
from pymilvus import Collection, MilvusException, connections, db, utility
from .process import Process

class ManageDB:
    def __init__(self, config: str):
        with open(config, "r") as f:
            self.config = yaml.safe_load(f)
    
    def list_databases(self):
        return list_databases(self.config.get("uri"))
    
    def list_collections(self, database: str):
        db_name = f"comm_{database}"
        return list_collections(self.config.get("uri"), db_name)
    
    def create_database(self, database: str):
        db_name = f"comm_{database}"
        return create_database(self.config.get("uri"), db_name)
    
    def create_collection(
            self,
            database: str,
            collection: str,
            files: list = None
            ):
        uri = self.config.get("uri")
        db_name = f"comm_{database}"

        # Connect to Milvus
        host = uri.split("://")[1].split(":")[0]
        port = int(uri.split(":")[-1])
        connections.connect(host=host, port=port)

        # Ensure database exists
        if db_name not in db.list_database():
            db.create_database(db_name)
        db.using_database(db_name)

        # Skip if collection already exists
        existing_collections = utility.list_collections()
        if collection in existing_collections:
            return True

        # Initialize store to leverage existing schema creation
        store = Store(
            uri=uri,
            database=db_name,
            collection=collection,
            k=self.config.get("k", 4),
            embedding_model=self.config.get("embedding_model"),
        )

        # Seed the collection with a placeholder document to trigger creation
        placeholder = Document(
            page_content="__placeholder__",
            metadata={
                "namespace": "__init__",
                "name": "__init__",
                "path": "N/A",
                "type": "placeholder",
            },
        )

        try:
            store.add([placeholder])
            collection_obj = Collection(collection)
            collection_obj.flush()
            collection_obj.load()
            collection_obj.delete(expr='namespace == "__init__"')
            collection_obj.flush()
            
            # Save selected files as collection properties
            if files:
                collection_obj.set_properties({"files": json.dumps(files)})
            
            collection_obj.release()
            
            # Process and add documents if files are provided
            if files:
                print(f"Processing {len(files)} files...")
                processor = Process()
                docs = processor.process(files)
                print(f"Processed {len(docs)} documents")
                
                # Add processed documents to the store
                store.add(docs)
                print(f"Added {len(docs)} documents to collection {collection}")
                
                # Flush and load collection to make documents visible
                collection_obj = Collection(collection)
                collection_obj.flush()
                collection_obj.load()
                print(f"Collection {collection} flushed and loaded")
            
        except MilvusException as exc:
            raise RuntimeError(f"Failed to create collection {collection}: {exc}") from exc

        return True
