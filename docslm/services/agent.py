from graphrag.graph.agent import GraphRAG
from graphrag.store.store import Store
import pandas as pd
from datetime import datetime
from io import BytesIO

class Agent:
    MODES = {
        'veloce': {
            'model': 'gpt-4.1-mini',
            'draw_thinking_level': 'low',
            'k': 4
        },
        'ragionamento': {
            'model': 'gpt-5-mini',
            'draw_thinking_level': 'low',
            'k': 10
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
    
    def invoke(self, query: str, user_id: str | None = None) -> str:
        return self.agent.run(query, user_id)

    def report(self, path: str, user_id: str | None = None) -> dict:
        """Process Excel file with queries and generate report in memory"""
        data = pd.read_excel(path)
        queries = data['queries'].tolist()
        
        responses = {}
        for query in queries:
            state = self.invoke(
                query=query,
                user_id=user_id
            )
            response = state['response']
            responses[query] = response
        
        # Create output DataFrame
        out = pd.DataFrame({
            'query': list(responses.keys()),
            'response': list(responses.values())
        })
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f'report_{timestamp}.xlsx'
        
        # Save to BytesIO instead of disk
        excel_buffer = BytesIO()
        out.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        
        return {
            'query': 'Generate report',
            'refined_query': 'Generate report',
            'response': f'Report generato da {len(queries)} queries.',
            'context': None,
            'user_id': user_id,
            'file_buffer': excel_buffer,
            'filename': output_filename,
            'query_count': len(queries)
        }

    

        