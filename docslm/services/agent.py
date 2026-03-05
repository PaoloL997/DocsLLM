from graphrag.graph.agent import GraphRAG
from graphrag.store.store import Store
import pandas as pd
from datetime import datetime
from io import BytesIO


class Agent:
    """Thin wrapper around GraphRAG that supports single-query and batch (report) modes."""

    MODES: dict[str, dict] = {
        'veloce': {
            'model': 'gpt-4.1-mini',
            'draw_thinking_level': 'low',
            'k': 4,
        },
        'ragionamento': {
            'model': 'gpt-5-mini',
            'draw_thinking_level': 'low',
            'k': 10,
        },
    }

    def __init__(
        self,
        store: Store,
        mode: str = 'veloce',
        model: str | None = None,
        rerank: bool = True,
        draw_thinking_level: str | None = None,
        draw_model: str = 'gemini-3-flash-preview',
    ) -> None:
        """Args:
            store: Initialised Store instance.
            mode: One of the keys in ``MODES`` ('veloce', 'ragionamento').
            model: Override the LLM model for this mode.
            rerank: Whether to enable document re-ranking.
            draw_thinking_level: Override drawing-pipeline thinking level.
            draw_model: Model used for drawing/image descriptions.
        """
        mode_cfg = self.MODES.get(mode, {})
        self.mode = mode
        self.model = model or mode_cfg.get('model', 'gpt-4.1-nano')
        self.draw_thinking_level = draw_thinking_level or mode_cfg.get('draw_thinking_level', 'low')

        self.agent = GraphRAG(
            store=store,
            llm=self.model,
            rerank=rerank,
            draw_thinking_level=self.draw_thinking_level,
            draw_model=draw_model,
        )
    
    def invoke(self, query: str, user_id: str | None = None) -> dict:
        """Run a single query through the agent graph.

        Args:
            query: User question.
            user_id: Optional identifier used for per-user memory isolation.

        Returns:
            Graph state dict containing at least ``response`` and ``context``.
        """
        return self.agent.run(query, user_id)

    def report(self, path: str, user_id: str | None = None) -> dict:
        """Process an Excel file with a ``queries`` column and return a report.

        Args:
            path: Path to the Excel file.
            user_id: Optional user identifier forwarded to ``invoke``.

        Returns:
            Dict with ``file_buffer`` (BytesIO), ``filename`` (str), and
            ``query_count`` (int).
        """
        queries = pd.read_excel(path)['queries'].tolist()

        responses = {q: self.invoke(q, user_id=user_id).get('response', '') for q in queries}

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        buf = BytesIO()
        pd.DataFrame({'query': list(responses), 'response': list(responses.values())}).to_excel(
            buf, index=False, engine='openpyxl'
        )
        buf.seek(0)

        return {
            'file_buffer': buf,
            'filename': f'report_{timestamp}.xlsx',
            'query_count': len(queries),
        }