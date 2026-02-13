# CSS Refactoring Documentation

## Overview
The original `style.css` file (2077 lines) has been refactored into a modular structure using CSS `@import` statements. This improves maintainability, readability, and allows for better organization of styles.

## File Structure

```
css/
├── style.css                    # Main entry point (imports all modules)
├── style-old.css                # Backup of original monolithic file
├── base/
│   ├── variables.css            # CSS custom properties (colors, spacing, etc.)
│   ├── reset.css                # CSS reset and scrollbar styles
│   └── typography.css           # Font definitions and text styles
├── layout/
│   ├── main.css                 # Layout container, main content, greeting
│   └── sidebar.css              # Sidebar layout and all sidebar components
└── components/
    ├── chat.css                 # Chat card, bubbles, history, and inputs
    ├── buttons.css              # All button styles (control, send, summary, etc.)
    ├── dropdowns.css            # Model dropdown and menu styles
    ├── modals.css               # Settings and report upload modals
    ├── animations.css           # Keyframe animations (spin, pulse, fade, slide)
    └── responsive.css           # Media queries for tablet and mobile
```

## Module Breakdown

### Base Modules
- **variables.css** - CSS custom properties for colors, spacing, border-radius, transitions, shadows
- **reset.css** - Box-sizing reset, scrollbar styling for webkit browsers
- **typography.css** - Font imports (Inter, Fira Mono), heading styles, code blocks

### Layout Modules
- **main.css** - `.layout`, `.container`, `.main`, `.greeting-section`, `.greeting-icon`, `.greeting-text`
- **sidebar.css** - All sidebar-related styles:
  - Base: `.sidebar`, `.sidebar.closed`
  - Header: `.sidebar-header`, `.sidebar-logo`, `.sidebar-toggle`
  - Navigation: `.sidebar-nav`, `.sidebar-action`, `.sidebar-links`, `.sidebar-link`
  - Search: `.sidebar-search`, `.sidebar-search-input`, `.sidebar-search-toggle`, `.sidebar-search-results`
  - Login: `.sidebar-login-form`, `.sidebar-login-input`, `.sidebar-login-btn`
  - Footer: `.sidebar-footer`, `.sidebar-user-info`, `.sidebar-avatar`, `.sidebar-user`, `.sidebar-user-name`, `.sidebar-user-plan`

### Component Modules
- **chat.css** - Chat interface components:
  - Card: `.chat-card`, `.chat-card.fixed`, `.chat-card-input`, `.chat-card-footer`
  - History: `.chat-history`, `.chat-row`, `.chat-bubble`
  - Input: `.message-input`
  - Controls: `.chat-controls-left`, `.chat-controls-right`
  - Status: `.agent-status`, `.agent-loading`, `.agent-success`, `.agent-error`, `.spinner-icon`
  - Loader: `.bubble-think-icon`, `.loader-timer`

- **buttons.css** - Button components:
  - `.control-btn` - Small icon buttons in chat footer
  - `.btn-send` - Primary send button with hover effects
  - `.summary-button` - Summary generation button
  - `.settings-button` - Settings toggle button
  - `.report-upload-button` - Styled upload button with gradient

- **dropdowns.css** - Dropdown menus:
  - `.model-control`, `.model-dropdown`, `.model-dropdown-menu`
  - `.model-option`, `.model-option-title`, `.model-option-desc`
  - `.model-menu-header`, `.model-upgrade-btn`
  - `.model-arrow`, `.model-check`

- **modals.css** - Modal dialogs:
  - Settings: `.settings-modal`, `.settings-dropdown-menu`, `.settings-option`, `.settings-param`, `.settings-input`
  - Report Upload: `.report-upload-modal`, `.report-upload-content`

- **animations.css** - CSS animations:
  - `@keyframes spin` - Rotating spinner
  - `@keyframes pulse` - Pulsing opacity
  - `@keyframes slideInUp` / `slideOutDown` - Vertical slide animations
  - `@keyframes slideUp` - Modal slide-up entrance
  - `@keyframes fadeIn` - Opacity fade-in

- **responsive.css** - Responsive breakpoints:
  - Tablet (max-width: 768px) - Horizontal sidebar, adjusted spacing
  - Mobile (max-width: 480px) - Vertical layout, smaller text, stacked controls

## Import Order
The `style.css` file imports modules in this specific order:
1. **Base** - Variables must load first, then reset, then typography
2. **Layout** - Main layout structure before components
3. **Components** - All UI components that use base and layout styles
4. **Animations** - Keyframes used by components
5. **Responsive** - Media queries override default styles last

## Benefits
- **Maintainability**: Each module has a clear, focused purpose
- **Readability**: Smaller files are easier to navigate and understand
- **Reusability**: Components can be modified independently
- **Performance**: Browser can cache individual modules
- **Collaboration**: Multiple developers can work on different modules without conflicts
- **Debugging**: Easier to locate and fix style issues in specific modules

## Migration Notes
- Original file backed up as `style-old.css`
- No HTML changes required - still imports `style.css`
- All CSS custom properties preserved in `base/variables.css`
- All class names and selectors remain unchanged
- Browser support: `@import` is supported in all modern browsers

## Usage
The main `style.css` file automatically imports all modules. No additional configuration needed in HTML. If you need to disable a specific module temporarily, comment out its `@import` line in `style.css`.

Example:
```css
/* @import url('components/animations.css'); */ /* Temporarily disabled */
```

## Maintenance
When adding new styles:
- **Variables**: Add to `base/variables.css`
- **Layout**: Add to appropriate layout module or create new one
- **Components**: Add to existing component module or create new one
- **Responsive**: Add media queries to `components/responsive.css`
- Remember to add new module imports to `style.css` if creating new files
