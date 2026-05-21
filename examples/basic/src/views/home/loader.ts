import type { LoaderFunction, LoaderResult } from '@l5e/core/entry-server';

export type HomeLoaderData = {
  now: string;
};

export const loader: LoaderFunction = async (): Promise<LoaderResult> => {
  return {
    props: {
      now: new Date().toISOString(),
    },
    maxAge: 0,
    sMaxAge: 60,
    swr: 300,
    cacheTags: ['home'],
  };
};
