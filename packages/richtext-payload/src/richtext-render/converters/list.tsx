import { v4 as uuidv4 } from 'uuid';
import { Fragment } from '@l5e/core/jsx-runtime';

import type { SerializedListItemNode, SerializedListNode } from '@payloadcms/richtext-lexical';
import type { JSXConverters } from '../types.js';

export const ListJSXConverter: JSXConverters<SerializedListItemNode | SerializedListNode> = {
  list: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({
      nodes: node.children,
    });

    const NodeTag = node.tag;

    return <NodeTag class={`list-${node?.listType}`}>{children}</NodeTag>;
  },
  listitem: ({ node, nodesToJSX, parent }) => {
    const hasSubLists = node.children.some((child) => child.type === 'list');

    const children = nodesToJSX({
      nodes: node.children,
    });

    if ('listType' in parent && parent?.listType === 'check') {
      const uuid = uuidv4();

      return (
        <li
          aria-checked={node.checked ? 'true' : 'false'}
          class={`list-item-checkbox${node.checked ? ' list-item-checkbox-checked' : ' list-item-checkbox-unchecked'}${hasSubLists ? ' nestedListItem' : ''}`}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          role="checkbox"
          style="list-style-type: none;"
          tabindex={'-1'}
          value={node?.value}
        >
          {hasSubLists ? (
            children
          ) : (
            <>
              <input checked={node.checked} id={uuid} readonly={true} type="checkbox" />
              <label for={uuid}>{children}</label>
              <br />
            </>
          )}
        </li>
      );
    } else {
      return (
        <li
          class={`${hasSubLists ? 'nestedListItem' : ''}`}
          style={hasSubLists ? 'list-style-type: none;' : ''}
          value={node?.value}
        >
          {children}
        </li>
      );
    }
  },
};
