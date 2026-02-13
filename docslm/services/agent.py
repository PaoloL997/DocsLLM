from graphrag.graph.agent import GraphRAG
from graphrag.store.store import Store
from langchain_core.documents import Document


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


    def summarize(self) -> str:
        summary_raw = self.agent.store.query(
            expression='namespace == "summary"',
            fields=["text"],
            limit=1
        )
        if not summary_raw:
            return {
                'query': "Give me a summary",
                'refined_query': "Give me a summary",
                'response': "Errore durante la generazione del riassunto. Contattare l'assistenza.",
                'context': None,
                'user_id': None,
            }
        summary = summary_raw[0]["text"]
        
        # Estrai info pulite da database e collection
        commessa = self.agent.store.database.replace("comm_", "")
        notebook = self.agent.store.collection.replace("_", " ")
        
        response = self.agent.llm.invoke(
            f"""# Role
Sei un assistente esperto nella redazione di documentazione tecnica e reportistica aziendale. Il tuo obiettivo è trasformare note disordinate in riassunti professionali ad alta leggibilità, utilizzando una formattazione Markdown avanzata ma pulita.

# Task
Genera un riassunto strutturato basato sui seguenti dati:
- **Commessa:** {commessa}
- **Notebook:** {notebook}
- **Contenuto:** {summary}

# Struttura dell'Output (Obbligatoria)
Per garantire la massima chiarezza, organizza la risposta seguendo rigorosamente questo schema:

## 1. Intestazione & Introduzione
Crea un titolo distintivo (es. ## Report Attività: [Nome Commessa]). Inserisci un paragrafo introduttivo che colleghi la commessa al notebook specifico, fornendo il contesto generale dell'operazione.

## 2. Punti Chiave e Aree Tematiche
Suddividi il contenuto in Sottotitoli di terzo livello (###). Ogni sezione deve rappresentare un pilastro del riassunto (es. ### Stato Avanzamento, ### Specifiche Tecniche, ### Criticità Riscontrate). Sotto ogni sottotitolo, usa brevi paragrafi descrittivi.

## 3. Analisi Dettagliata
Sviluppa i concetti più complessi in paragrafi fluidi e ben articolati. Evita l'abuso di liste puntate; se necessario, usa il grassetto all'interno del testo per evidenziare termini tecnici, scadenze, nomi di responsabili o decisioni chiave.

## 4. Sintesi Operativa (Highlight)
Usa una linea orizzontale (---) per separare questa sezione, poi concludi con un Blockquote (>). All'interno del blocco, scrivi una singola frase o un breve elenco che riassuma l'azione immediata da compiere o la conclusione principale del documento.

# Guidelines Finali
- No Tabelle: Non utilizzare tabelle.
- No Liste Massive: Limita le liste puntate allo stretto necessario (massimo 2-3 punti per sezione).
- Stile: Italiano professionale, asciutto e orientato al risultato.
- Precisione: Non tralasciare dettagli tecnici presenti nel testo originale.
"""
        )
        return {
            'query': "Give me a summary",
            'refined_query': "Give me a summary",
            'response': response.content if hasattr(response, 'content') else str(response),
            'context': None,
            'user_id': None,
        }
        

        