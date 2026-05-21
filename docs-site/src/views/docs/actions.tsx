import { defineAction } from '@withl5e/l5e/action';

import { runSearchAction } from '~/features/search/runSearch';

export const searchDocs = defineAction({
  method: 'GET',
  handler: async (req) => runSearchAction(String(req.query?.q ?? '')),
});
