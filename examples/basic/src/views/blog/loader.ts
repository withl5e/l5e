import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

export type BlogLoaderData = {
  slug: string;
  page: number;
};

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  return {
    props: {
      slug: String(requestInfo.params?.slug ?? ''),
      page: Number(requestInfo.params?.page ?? 1),
    },
    maxAge: 0,
  };
};
