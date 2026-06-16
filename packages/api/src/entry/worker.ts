// Register all operations (side-effect import)
import '../shared/operations';

import { createRestApp } from '../adapters/rest/app';

const app = createRestApp();

export default app;
