/** DR viewer stub — client-mod ignore UI not available in static snapshot mode. */
const ClientModIgnores = {
  load() {
    return {};
  },
  hasClientNoiseConcern() {
    return false;
  },
  effectiveSummary() {
    return null;
  },
  hasActionableClientMods() {
    return false;
  },
  async postIgnore() {
    return {};
  },
};
