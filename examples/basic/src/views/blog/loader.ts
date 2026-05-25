import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export type BlogLoaderData = {
  slug: string;
};

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  return {
    props: {
      slug: String(requestInfo.params?.slug ?? ''),
    },
    maxAge: 0,
  };
};
