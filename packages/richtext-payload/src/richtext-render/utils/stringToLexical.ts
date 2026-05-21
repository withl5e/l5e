export type LexicalContent = {
  root: {
    type: string;
    format: '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify';
    indent: number;
    version: number;
    direction: 'ltr' | 'rtl' | null;
    children: Array<{ type: any; version: number; [k: string]: unknown }>;
  };
  [k: string]: unknown;
};

export function stringToLexical(text: string | null | undefined): LexicalContent {
  const raw = text == null ? '' : String(text);
  const lines = raw.length === 0 ? [''] : raw.split(/\r?\n/);

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: lines.map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children:
          line.length === 0
            ? []
            : [
                {
                  type: 'text',
                  text: line,
                  version: 1,
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                },
              ],
      })),
    },
  };
}
