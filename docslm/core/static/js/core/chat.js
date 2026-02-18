/**
 * Chat Module - Handles chat UI, message rendering, and markdown parsing
 */

import { escapeHtml, autoResizeTextarea } from './utils.js';

/**
 * Ensure chat interface is visible and properly positioned
 */
export function ensureChatVisible() {
    const chatHistory = document.getElementById('chatHistory');
    const greetingSection = document.querySelector('.greeting-section');
    const chatCard = document.querySelector('.chat-card');
    if (greetingSection) greetingSection.style.display = 'none';
    if (chatHistory) chatHistory.classList.add('active');
    if (chatCard) {
        chatCard.classList.add('fixed');
        // align composer with the center of the `.container` so messages and textarea stay aligned
        const container = document.querySelector('.container');
        function alignChatCard() {
            if (!chatCard) return;
            if (container) {
                const rect = container.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                // set left in viewport pixels and translate to center
                chatCard.style.left = `${centerX}px`;
                chatCard.style.transform = 'translateX(-50%)';
            } else {
                chatCard.style.left = '50%';
                chatCard.style.transform = 'translateX(-50%)';
            }
        }

        // Store globally so sidebar toggle can call it
        window.alignChatCardGlobal = alignChatCard;

        // align now and on resize (keeps centered if window/container changes)
        alignChatCard();
        window.addEventListener('resize', alignChatCard);
    }
}

/**
 * Append a message to the chat history
 * @param {string} role - 'user' or 'assistant'
 * @param {string} text - Message text
 * @param {boolean} isHtml - Whether text is HTML
 * @returns {HTMLElement} The created row element
 */
export function appendMessage(role, text, isHtml) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;

    const row = document.createElement('div');
    row.className = `chat-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    if (role === 'assistant') {
        if (isHtml) {
            bubble.innerHTML = text || '';
        } else {
            bubble.innerHTML = renderMarkdown(text || '');
        }
    } else {
        bubble.textContent = text;
    }
    row.appendChild(bubble);
    chatHistory.appendChild(row);
    
    // Scroll to show the new message at the top of the viewport
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 100);
    
    return row;
}

/**
 * Append a loading indicator to chat
 * @returns {HTMLElement} The loader row element
 */
export function appendLoader() {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    const row = document.createElement('div');
    row.className = 'chat-row assistant';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble loader';

    // small pulsing icon using same visual language as .greeting-icon
    const icon = document.createElement('span');
    icon.className = 'bubble-think-icon';
    icon.textContent = '✱';

    const timer = document.createElement('span');
    timer.className = 'loader-timer';
    timer.textContent = '0s';

    bubble.appendChild(icon);
    bubble.appendChild(timer);
    row.appendChild(bubble);
    chatHistory.appendChild(row);

    // start timer (seconds)
    const start = Date.now();
    // update every 50ms to include milliseconds in display
    const interval = setInterval(() => {
        const elapsedMs = Date.now() - start;
        const elapsedSec = (elapsedMs / 1000).toFixed(3);
        timer.textContent = `${elapsedSec}s`;
    }, 50);
    // store reference so callers can clear it
    row._timer = interval;

    // ensure newest loader is visible (we scroll main so loader is in view)
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 50);

    return row;
}

/**
 * Render markdown text to HTML
 * @param {string} md - Markdown text
 * @returns {string} HTML string
 */
export function renderMarkdown(md) {
    if (!md) return '';
    
    // Normalize line endings
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Step 1: Extract and protect code blocks
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, function(_, code) {
        const id = `@@CODEBLOCK${codeBlocks.length}@@`;
        codeBlocks.push(code);
        return '\n' + id + '\n';
    });

    // Step 2: Extract and protect inline code spans
    const inlineCode = [];
    md = md.replace(/`([^`]+)`/g, function(_, code) {
        const id = `@@INLINECODE${inlineCode.length}@@`;
        inlineCode.push(code);
        return id;
    });

    // Step 3: Escape HTML
    md = escapeHtml(md);

    // Step 4: Parse block-level elements (tables, lists, headings, paragraphs)
    const lines = md.split('\n');
    let html = '';
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }
        
        // Table detection (| header | ... | on current line and separator on next)
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|\-]+\|?\s*$/.test(lines[i + 1])) {
            const tableLines = [line, lines[i + 1]];
            i += 2;
            // Collect remaining table rows
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                tableLines.push(lines[i]);
                i++;
            }
            html += parseTable(tableLines);
            continue;
        }
        
        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            html += `<h${level}>${content}</h${level}>`;
            i++;
            continue;
        }
        
        // Ordered list item
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (olMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)(\d+)\.\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ol');
            continue;
        }
        
        // Unordered list item
        const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
        if (ulMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)([-*+])\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ul');
            continue;
        }
        
        // Blockquote
        if (line.match(/^>\s*/)) {
            const quoteLines = [];
            while (i < lines.length && lines[i].match(/^>\s*/)) {
                quoteLines.push(lines[i].replace(/^>\s*/, ''));
                i++;
            }
            html += `<blockquote>${quoteLines.join(' ')}</blockquote>`;
            continue;
        }
        
        // Regular paragraph - collect consecutive non-special lines
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== '' && 
               !lines[i].match(/^#{1,6}\s/) && 
               !lines[i].match(/^\s*(\d+\.|-|\*|\+)\s/) && 
               !lines[i].match(/^>\s*/) &&
               !lines[i].includes('@@CODEBLOCK')) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            html += `<p>${paraLines.join(' ')}</p>`;
        }
    }

    // Step 5: Inline formatting (bold, italic, links) - process within HTML
    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_) - careful not to conflict with bold
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Step 6: Restore inline code
    html = html.replace(/@@INLINECODE(\d+)@@/g, function(_, idx) {
        return `<code>${inlineCode[parseInt(idx, 10)]}</code>`;
    });

    // Step 7: Restore code blocks
    html = html.replace(/@@CODEBLOCK(\d+)@@/g, function(_, idx) {
        const code = codeBlocks[parseInt(idx, 10)];
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });

    return html;
}

/**
 * Parse markdown table into HTML
 * @param {Array<string>} lines - Table lines
 * @returns {string} HTML table string
 */
function parseTable(lines) {
    if (lines.length < 2) return '';
    
    // Parse header
    const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c !== '');
    
    // Parse data rows (skip separator at index 1)
    const dataRows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '');
        if (cells.length > 0) {
            dataRows.push(cells);
        }
    }
    
    let table = '<table class="md-table"><thead><tr>';
    headerCells.forEach(cell => {
        table += `<th>${cell}</th>`;
    });
    table += '</tr></thead>';
    
    if (dataRows.length > 0) {
        table += '<tbody>';
        dataRows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => {
                table += `<td>${cell}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody>';
    }
    
    table += '</table>';
    return table;
}

/**
 * Build nested HTML list from items
 * @param {Array} items - List items with indent levels
 * @param {string} type - 'ol' or 'ul'
 * @returns {string} HTML list string
 */
function buildNestedList(items, type) {
    const stack = [];
    let html = '';
    
    items.forEach((item, idx) => {
        const indent = item.indent;
        const content = item.content;
        
        // Close lists if we dedent
        while (stack.length > 0 && stack[stack.length - 1] > indent) {
            stack.pop();
            html += `</${type}>`;
        }
        
        // Open new list if we indent
        if (stack.length === 0 || indent > stack[stack.length - 1]) {
            html += `<${type}>`;
            stack.push(indent);
        }
        
        html += `<li>${content}</li>`;
    });
    
    // Close remaining lists
    while (stack.length > 0) {
        stack.pop();
        html += `</${type}>`;
    }
    
    return html;
}

/**
 * Setup chat-related event listeners
 */
export function setupChatListeners() {
    const messageInput = document.getElementById('messageInput');
    
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            autoResizeTextarea(messageInput);
        });
        autoResizeTextarea(messageInput);
    }
}
