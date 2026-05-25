import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export type DocsLoaderData = {
  path: string;
};

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  return {
    props: {
      path: String(requestInfo.params?._splat ?? ''),
    },
    maxAge: 0,
  };
};
