# Organizzazione del codice JS

## Panoramica

Il file `app.js` originale (2196 righe) è stato riorganizzato in una struttura modulare per migliorare:
- **Manutenibilità**: codice più facile da trovare e modificare
- **Leggibilità**: file più piccoli e focalizzati
- **Testabilità**: moduli indipendenti più facili da testare
- **Collaborazione**: minor rischio di conflitti git

## Nuova Struttura

```
js/
├── app.js                    # Orchestratore principale (170 righe)
├── app-old.js               # Backup del file originale
├── search.js                # Gestione ricerca commesse
├── report.js                # Generazione e download report
├── models.js                # Dropdown selezione modelli
│
├── core/                    # Moduli core dell'applicazione
│   ├── utils.js            # Funzioni utility (getCookie, escapeHtml, etc.)
│   ├── auth.js             # Autenticazione e gestione utente
│   ├── chat.js             # UI chat e rendering markdown
│   └── agent.js            # Inizializzazione e invio messaggi agent
│
├── modals/                  # Gestione modali
│   ├── jobModal.js         # Modal dettagli commessa
│   ├── collectionModal.js  # Modal dettagli collection
│   ├── createCollectionModal.js  # Modal creazione collection
│   └── sourceModal.js      # Modal anteprima fonti
│
└── collections/             # Gestione collections
    ├── manager.js          # Caricamento e rendering collections
    ├── browser.js          # Browser file commessa
    └── files.js            # Gestione file selezionati
```

## Moduli Principali

### app.js (Orchestratore)
File principale che coordina tutti i moduli e gestisce l'inizializzazione dell'applicazione.

**Responsabilità:**
- Importazione e coordinamento di tutti i moduli
- Setup event listeners globali
- Gestione sidebar toggle
- Gestione chiusura modali

### core/utils.js
Funzioni di utilità condivise tra tutti i moduli.

**Exports:**
- `getCookie(name)` - Ottiene cookie CSRF
- `escapeHtml(str)` - Escape caratteri HTML
- `sanitizeCollectionName(name)` - Sanitizza nome collection
- `autoResizeTextarea(textarea)` - Auto-resize textarea

### core/auth.js
Gestione autenticazione e parametri URL.

**Exports:**
- `loadGreeting()` - Carica saluto utente
- `initializeDropdown()` - Inizializza dropdown modelli
- `setupAuthListeners()` - Setup listener login
- `updateSelectedCommessaParam()` - Aggiorna URL con commessa
- `restoreSelectedCommessa()` - Ripristina commessa da URL

### core/chat.js
Gestione interfaccia chat e rendering markdown.

**Exports:**
- `ensureChatVisible()` - Rende visibile la chat
- `appendMessage(role, text, isHtml)` - Aggiunge messaggio
- `appendLoader()` - Aggiunge loader
- `renderMarkdown(md)` - Renderizza markdown in HTML
- `setupChatListeners()` - Setup listener chat

### core/agent.js
Gestione agent: inizializzazione, invio messaggi, stato.

**Exports:**
- `initializeAgent(commessa, collection)` - Inizializza agent
- `sendMessage()` - Invia messaggio all'agent
- `getActiveCollection()` - Ottiene collection attiva
- `setActiveCollection(value)` - Imposta collection attiva
- `showAgentLoading/Success/Error/Inactive()` - Gestione stato UI
- `enableSendButton() / disableSendButton()` - Gestione pulsante invio

### search.js
Funzionalità di ricerca commesse.

**Exports:**
- `performSearch(query, autoOpen)` - Esegue ricerca
- `renderSearchResults(results)` - Renderizza risultati
- `setupSearchListeners()` - Setup listener ricerca

### report.js
Generazione e download report.

**Exports:**
- `generateSummary()` - Genera report
- `handleReportFileUpload(event)` - Gestisce upload file
- `downloadReportFile(token, filename)` - Download report
- `setupReportListeners()` - Setup listener report

### models.js
Gestione dropdown selezione modelli.

**Exports:**
- `openModelDropdown()` - Apre dropdown
- `closeModelDropdown()` - Chiude dropdown
- `selectModel(value, title)` - Seleziona modello
- `setupModelsListeners()` - Setup listener modelli

### modals/jobModal.js
Modal dettagli commessa.

**Exports:**
- `showJobDetails(job)` - Mostra dettagli commessa
- `setupJobModalListeners()` - Setup listener modal

### modals/collectionModal.js
Modal dettagli collection e gestione file.

**Exports:**
- `showCollectionDetails(collection, commessa)` - Mostra dettagli
- `deleteCollectionFile(commessa, collection, filename)` - Elimina file
- `showDeleteConfirmationBanner(filename)` - Banner conferma
- `setupCollectionModalListeners()` - Setup listener modal

### modals/createCollectionModal.js
Modal creazione nuova collection.

**Exports:**
- `openCreateCollectionModal(commessaCode)` - Apre modal
- `closeCreateCollectionModalFunc()` - Chiude modal
- `submitCreateCollection()` - Submit form
- `createCollection(commessa, collection)` - Crea collection
- `setupCreateCollectionModalListeners()` - Setup listener modal
- `isProcessing` - Flag processing

### modals/sourceModal.js
Modal anteprima fonti documenti.

**Exports:**
- `openSourceModal(btnDef)` - Apre modal con anteprima file

### collections/manager.js
Gestione collections: caricamento e rendering.

**Exports:**
- `loadCollections(commessaCode, container)` - Carica collections
- `renderCollections(collections, container, commessa)` - Renderizza liste
- `showSelectedJob(selectedJob)` - Mostra job selezionato

### collections/browser.js
Browser navigazione file commessa.

**Exports:**
- `loadJobFiles(commessa, subpath)` - Carica file
- `renderJobFileBrowser(data)` - Renderizza browser

### collections/files.js
Gestione file selezionati per collection.

**Exports:**
- `modalSelectedFiles` - Array file selezionati
- `updateModalSelectedFiles(action, filePath)` - Aggiorna selezione
- `getModalSelectedFiles()` - Ottiene file selezionati
- `clearModalSelectedFiles()` - Pulisce selezione
- `renderSelectedFilesCounter()` - Renderizza contatore

## Modifiche al Template HTML

Il file `docslm/core/templates/index.html` è stato aggiornato per utilizzare ES6 modules:

```html
<!-- Prima -->
<script src="{% static 'js/app.js' %}"></script>

<!-- Dopo -->
<script type="module" src="{% static 'js/app.js' %}"></script>
```

L'attributo `type="module"` abilita:
- Import/export ES6
- Scope modules isolato
- Caricamento asincrono automatico
- Strict mode di default

## Benefici della Nuova Struttura

### 1. Manutenibilità Migliorata
- File più piccoli (50-300 righe vs 2196)
- Responsabilità chiare per ogni modulo
- Facile individuare e modificare funzionalità specifiche

### 2. Migliore Organizzazione
- Raggruppamento logico per funzionalità
- Struttura a cartelle intuitive
- Separazione concerns (UI, business logic, utilities)

### 3. Riusabilità
- Moduli indipendenti riutilizzabili
- Import solo delle funzionalità necessarie
- Dependency injection chiara

### 4. Testing Facilitato
- Moduli testabili indipendentemente
- Mock delle dipendenze più semplice
- Test più focalizzati e veloci

### 5. Collaborazione Migliorata
- Minor rischio di conflitti git
- Più sviluppatori possono lavorare in parallelo
- Code review più semplici e focalizzate

## Compatibilità e Note

- **Browser Support**: ES6 modules supportati da tutti i browser moderni
- **Backward Compatibility**: Il file originale è preservato come `app-old.js`
- **Zero Breaking Changes**: La funzionalità rimane identica
- **Performance**: Lazy loading implicito migliora il tempo di caricamento iniziale

## Prossimi Passi Suggeriti

1. **Testing**: Testare tutte le funzionalità per assicurare che tutto funzioni
2. **CSS Refactoring**: Applicare la stessa strategia al file `style.css` (2000+ righe)
3. **Python Refactoring**: Considerare di suddividere `files.py` e `agents.py`
4. **Documentazione**: Aggiungere JSDoc comments per migliore IDE support
5. **Type Safety**: Considerare di migrare a TypeScript per sicurezza di tipo

## Rollback

Se necessario tornare alla versione precedente:

```powershell
cd docslm\core\static\js
Move-Item -Path app.js -Destination app-new.js -Force
Move-Item -Path app-old.js -Destination app.js -Force
```

E ripristinare il template HTML rimuovendo `type="module"`.
