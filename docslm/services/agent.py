from graphrag.agent import GraphRAG
from graphrag.store import Store


class Agent:
    def __init__(
            self,
            store: Store,
            model: str = "gpt-4.1-nano",
            rerank: bool = True
            ):
        self.agent = GraphRAG(
            store=store,
            llm=model,
            rerank=rerank
        )
    
    def invoke(self, query: str):
        return self.agent.run(query)