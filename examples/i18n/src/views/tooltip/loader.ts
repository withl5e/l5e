import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export type TooltipLoaderData = {
  type: string;
  id: string;
};

// `rawHtml: true` skips the `index.html` shell — the client's tooltip runtime
// (`@withl5e/l5e/tooltip`) does `tip.innerHTML = await fetch(...).then(r => r.text())`,
// so this route must return just the fragment, not a full document.
export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  const { type, id } = requestInfo.params as { type: string; id: string };
  return {
    props: { type, id },
    rawHtml: true,
  };
};
