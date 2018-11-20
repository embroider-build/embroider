import { Tree } from "broccoli-plugin";
import Package from "./package";

// The Workspace represents our directory that will contain a complete vanilla
// Ember app. It's weird for a broccoli plugin, because we have strong opinions
// about symlinks that don't match Broccoli's. So instead of writing to our own
// assigned (temporary) output directory, we maintain our own final destination
// directory. It's still important that we particpate in the Brococli dependency
// graph. That is, later stages that depend on us must still include us as an
// input tree, even though they won't actually read from our outputDir as
// broccoli understands it.
//
// Our own broccoli build step is responsible only for assembling the proper
// node_modules structure with all our dependencies in v2 format. It leaves an
// empty place for the app's own code to go.
export default interface Workspace extends Tree {

  // this promise is only guaranteed to resolve if you are causing the Workspace
  // to be included in a broccoli build.
  ready(): Promise<{
    // the location inside the workspace where the app's code will go.
    appDestDir: string;

    // The phase 2 build takes this as input to discover the application's
    // as-authored source code as well as the complete set of the app's
    // v2-formatted dependencies.
    app: Package;
  }>;

}
