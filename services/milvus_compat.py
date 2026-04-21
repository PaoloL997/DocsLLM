"""Compatibility patch for langchain_milvus + pymilvus 2.6.x.

In pymilvus 2.6.x, MilvusClient uses an internal ConnectionManager and no
longer registers connections in the ORM ``connections`` registry. However,
langchain_milvus 0.3.x still accesses ``Collection(name, using=alias)``
which requires the alias to exist in that registry.

This module monkey-patches the ``Milvus.col`` property so that it lazily
registers the ORM connection on first access, bridging the gap between the
two APIs.

Call ``apply()`` once at import time — before any ``Store`` or ``Milvus``
instance is created.
"""

_applied = False


def apply():
    """Monkey-patch ``Milvus.col`` to register ORM connections lazily."""
    global _applied
    if _applied:
        return
    _applied = True

    from langchain_milvus import Milvus
    from pymilvus import Collection, connections

    _original_fset = Milvus.col.fset

    def _patched_col_fget(self):
        current_key = f"{self.collection_name}:{self.alias}"

        if self._cache_key == current_key and self._col_cache is not None:
            return self._col_cache

        if self.client.has_collection(self.collection_name):
            try:
                connections._fetch_handler(self.alias)
            except Exception:
                conn_args = self._connection_args or {}
                uri = conn_args.get("uri", "http://localhost:19530")
                db_name = conn_args.get("db_name", "")
                host = uri.split("://")[1].split(":")[0]
                port = int(uri.split(":")[-1])
                connections.connect(
                    alias=self.alias, host=host, port=port, db_name=db_name,
                )

            self._col_cache = Collection(
                self.collection_name, using=self.alias,
            )
            if self.collection_properties is not None:
                self._col_cache.set_properties(self.collection_properties)
            self._cache_key = current_key
            return self._col_cache

        self._col_cache = None
        self._cache_key = None
        return None

    Milvus.col = property(_patched_col_fget, _original_fset)
