import type {
  SerializedTableCellNode,
  SerializedTableNode,
  SerializedTableRowNode,
} from '@payloadcms/richtext-lexical';
import type { JSXConverters } from '../types.js';

export const TableJSXConverter: JSXConverters<
  SerializedTableCellNode | SerializedTableNode | SerializedTableRowNode
> = {
  table: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({
      nodes: node.children,
    });
    return (
      <div class="lexical-table-container">
        <table class="lexical-table" style="border-collapse: collapse;">
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  },
  tablecell: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({
      nodes: node.children,
    });

    const TagName = node.headerState > 0 ? 'th' : 'td'; // Use capital letter to denote a component
    const headerStateClass = `lexical-table-cell-header-${node.headerState}`;
    let style = '';
    if (node.backgroundColor) {
      style += `background-color: ${node.backgroundColor};`;
    }

    style += `border: 1px solid #ccc;`;

    style += `padding: 8px;`;

    // Note: JSX does not support setting attributes directly as strings, so you must convert the colSpan and rowSpan to numbers
    const colSpan = node.colSpan && node.colSpan > 1 ? node.colSpan : undefined;
    const rowSpan = node.rowSpan && node.rowSpan > 1 ? node.rowSpan : undefined;

    return (
      <TagName
        class={`lexical-table-cell ${headerStateClass}`}
        colspan={colSpan} // colSpan and rowSpan will only be added if they are not null
        rowspan={rowSpan}
        style={style}
      >
        {children}
      </TagName>
    );
  },
  tablerow: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({
      nodes: node.children,
    });
    return <tr class="lexical-table-row">{children}</tr>;
  },
};
