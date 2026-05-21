import type {
  GenerateMetadataFunction,
  LoaderFunction,
  LoaderResult,
} from '@withl5e/l5e/entry-server';

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

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: 'L5E starter',
  description: 'A minimal L5E app.',
});
