from graphrag.agent import GraphRAG
from graphrag.store import Store


class Agent:
    # Configurazioni predefinite per le modalità
    MODES = {
        'veloce': {
            'model': 'gpt-4.1-nano',
            'draw_thinking_level': 'low'
        },
        'bilanciata': {
            'model': 'gpt-5-nano',
            'draw_thinking_level': 'medium'
        },
        'ragionamento': {
            'model': 'gpt-5-mini',
            'draw_thinking_level': 'high'
        }
    }
    
    def __init__(
            self,
            store: Store,
            mode: str = "veloce",
            model: str = None,
            rerank: bool = True,
            draw_thinking_level: str = None,
            draw_model: str = "gemini-3-flash-preview",
            ):
        # Se viene specificata una modalità, usa le sue configurazioni
        if mode in self.MODES:
            mode_config = self.MODES[mode]
            if model is None:
                model = mode_config['model']
            if draw_thinking_level is None:
                draw_thinking_level = mode_config['draw_thinking_level']
        else:
            # Fallback ai valori di default se modalità non riconosciuta
            if model is None:
                model = "gpt-4.1-nano"
            if draw_thinking_level is None:
                draw_thinking_level = "low"
        
        self.mode = mode
        self.model = model
        self.draw_thinking_level = draw_thinking_level
        
        self.agent = GraphRAG(
            store=store,
            llm=model,
            rerank=rerank,
            draw_thinking_level=draw_thinking_level,
            draw_model=draw_model,
        )
    
    def invoke(self, query: str):
        return self.agent.run(query)