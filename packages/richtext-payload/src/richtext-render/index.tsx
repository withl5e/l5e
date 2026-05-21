/* eslint-disable no-console */
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import { cloneElement, Fragment, isValidElement } from '@l5e/core/jsx-runtime';

import type { SerializedBlockNode, SerializedInlineBlockNode } from '@payloadcms/richtext-lexical';
import { hasText } from '@payloadcms/richtext-lexical/shared';
import type { JSXConverter, JSXConverters, SerializedLexicalNodeWithParent } from './types.js';

export { defaultJSXConverters } from './defaultConverters.js';

export { stringToLexical } from './utils/stringToLexical.js';
export { genFragmentIdentifier } from './utils/genFragmentIdentifier.js';
export {
  buildTableOfContents,
  getHeaders,
  type TableOfContentsHeading,
  type TableOfContentsHeadingWithChildren,
} from './utils/getTableOfContents.js';
export { getTextLexicalNode } from './utils/getTextOfLexical.js';
export { getTimeRead } from './utils/getTimeRead.js';

export type ConvertLexicalToJSXArgs = {
  converters: JSXConverters;
  data: SerializedEditorState;
  disableIndent?: boolean | string[];
  disableTextAlign?: boolean | string[];
};

export function convertLexicalToJSX({
  converters,
  data,
  disableIndent,
  disableTextAlign,
}: ConvertLexicalToJSXArgs): JSX.Element {
  if (hasText(data)) {
    return (
      <Fragment>
        {convertLexicalNodesToJSX({
          converters,
          disableIndent,
          disableTextAlign,
          nodes: data?.root?.children,
          parent: data?.root,
        })}
      </Fragment>
    );
  }
  return <Fragment />;
}

export function convertLexicalNodesToJSX({
  converters,
  disableIndent,
  disableTextAlign,
  nodes,
  parent,
}: {
  converters: JSXConverters;
  disableIndent?: boolean | string[];
  disableTextAlign?: boolean | string[];
  nodes: SerializedLexicalNode[];
  parent: SerializedLexicalNodeWithParent;
}): JSX.Element[] {
  const unknownConverter: JSXConverter<any> = converters.unknown as JSXConverter<any>;

  const jsxArray: JSX.Element[] = nodes.map((node, i) => {
    let converterForNode: JSXConverter<any> | undefined;
    if (node.type === 'block') {
      converterForNode = converters?.blocks?.[(node as SerializedBlockNode)?.fields?.blockType];
      if (!converterForNode && !unknownConverter) {
        console.error(
          `Lexical => JSX converter: Blocks converter: found ${(node as SerializedBlockNode)?.fields?.blockType} block, but no converter is provided`,
        );
      }
    } else if (node.type === 'inlineBlock') {
      converterForNode =
        converters?.inlineBlocks?.[(node as SerializedInlineBlockNode)?.fields?.blockType];
      if (!converterForNode && !unknownConverter) {
        console.error(
          `Lexical => JSX converter: Inline Blocks converter: found ${(node as SerializedInlineBlockNode)?.fields?.blockType} inline block, but no converter is provided`,
        );
      }
    } else {
      converterForNode = converters[node.type] as JSXConverter<any>;
    }

    try {
      if (!converterForNode && unknownConverter) {
        converterForNode = unknownConverter;
      }

      let reactNode: JSX.Element;
      if (converterForNode) {
        const converted =
          typeof converterForNode === 'function'
            ? converterForNode({
                childIndex: i,
                converters,
                node,
                nodesToJSX: (args) => {
                  return convertLexicalNodesToJSX({
                    converters: args.converters ?? converters,
                    disableIndent: args.disableIndent ?? disableIndent,
                    disableTextAlign: args.disableTextAlign ?? disableTextAlign,
                    nodes: args.nodes,
                    parent: args.parent ?? {
                      ...node,
                      parent,
                    },
                  });
                },
                parent,
              })
            : converterForNode;
        reactNode = converted;
      } else {
        reactNode = <span key={i}>unknown node</span>;
      }

      let style: string = '';

      // Check if disableTextAlign is not true and does not include node type
      if (
        !disableTextAlign &&
        (!Array.isArray(disableTextAlign) || !disableTextAlign?.includes(node.type))
      ) {
        if ('format' in node && node.format) {
          switch (node.format) {
            case 'center':
              style += 'text-align: center;';
              break;
            case 'end':
              style += 'text-align: right;';
              break;
            case 'justify':
              style += 'text-align: justify;';
              break;
            case 'left':
              //style.textAlign = 'left'
              // Do nothing, as left is the default
              break;
            case 'right':
              style += 'text-align: right;';
              break;
            case 'start':
              style += 'text-align: left;';
              break;
          }
        }
      }

      if (
        !disableIndent &&
        (!Array.isArray(disableIndent) || !disableIndent?.includes(node.type))
      ) {
        if ('indent' in node && node.indent && node.type !== 'listitem') {
          // the unit should be px. Do not change it to rem, em, or something else.
          // The quantity should be 40px. Do not change it either.
          // See rationale in
          // https://github.com/payloadcms/payload/issues/13130#issuecomment-3058348085
          style += `padding-inline-start: ${Number(node.indent) * 40}px;`;
        }
      }

      if (isValidElement(reactNode)) {
        // Inject style into reactNode
        if (style) {
          const existingStyle =
            typeof reactNode?.props?.style === 'string' ? reactNode.props.style : '';
          const newStyle = `${style} ${existingStyle}`.trim();

          return cloneElement(reactNode, {
            key: i,
            style: newStyle,
          });
        }
        return cloneElement(reactNode, {
          key: i,
        });
      }

      return reactNode;
    } catch (error) {
      console.error('Error converting lexical node to JSX:', error, 'node:', node);
      return null;
    }
  });

  return jsxArray.filter(Boolean);
}
