/**
 * Default Lexical theme. Class names map to selectors in `src/styles/editor.css`.
 * Hosts can override by passing `theme` to `VisualEditor`; all classes are
 * namespaced under `quillmark-editor-` to minimize host-CSS conflicts (see O2).
 */

import type { EditorThemeClasses } from 'lexical';

export const defaultTheme: EditorThemeClasses = {
  ltr: 'qme-ltr',
  rtl: 'qme-rtl',
  paragraph: 'qme-paragraph',
  heading: {
    h1: 'qme-h1',
    h2: 'qme-h2',
    h3: 'qme-h3',
    h4: 'qme-h4',
    h5: 'qme-h5',
    h6: 'qme-h6',
  },
  list: {
    nested: { listitem: 'qme-nested-li' },
    ol: 'qme-ol',
    ul: 'qme-ul',
    listitem: 'qme-li',
    listitemChecked: 'qme-li-checked',
    listitemUnchecked: 'qme-li-unchecked',
  },
  link: 'qme-link',
  text: {
    bold: 'qme-bold',
    italic: 'qme-italic',
    underline: 'qme-underline',
    strikethrough: 'qme-strike',
    code: 'qme-code-inline',
  },
  quote: 'qme-quote',
  code: 'qme-code',
  table: 'qme-table',
  tableCell: 'qme-table-cell',
  tableCellHeader: 'qme-table-cell-header',
  tableRow: 'qme-table-row',
};
