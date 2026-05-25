import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export type DocsLoaderData = {
  path: string;
  segments: string[];
};

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  const segments = (requestInfo.params?.path ?? []) as string[];
  return {
    props: {
      path: segments.join('/'),
      segments,
    },
    maxAge: 0,
  };
};
