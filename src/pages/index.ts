// Pages and design module entry point: the shared shell plus every page the router renders.
// Related screens kept at their original paths: ../player-ui, ../organizer, ../plans, ../dashboard-ui, ../ui/.
export { page, shell } from "./shell";
export { createForm, PICK_PRESETS } from "./landing";
export { errorPage, notFoundPage, notOpenYetPage, organizersOnlyPage, notLocked } from "./errors";
export { statusUrl, timerInfo, pickedWords } from "./player";
export { leaderboardPage } from "./leaderboard";
export { plansPage } from "../plans";
export { entryView, lockedView, submittedView, timesUpView, waitingView } from "../player-ui";
export { organizerView } from "../organizer";
