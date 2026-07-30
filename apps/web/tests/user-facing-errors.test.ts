import assert from "node:assert/strict";
import {
  AGENT_CAPACITY_USER_MESSAGE,
  AGENT_TIMEOUT_ERROR,
  friendlyAgentUserMessage,
  isAgentCapacityError,
  isAgentTimeoutError
} from "../src/lib/agent/user-facing-errors";

assert.equal(isAgentTimeoutError(new Error(AGENT_TIMEOUT_ERROR)), true);
assert.equal(isAgentTimeoutError(new Error("Request timed out")), true);
assert.equal(isAgentTimeoutError(new Error("something else")), false);
assert.equal(isAgentCapacityError(new Error("429 rate limit")), true);

const friendly = friendlyAgentUserMessage(new Error(AGENT_TIMEOUT_ERROR));
assert.equal(friendly, AGENT_CAPACITY_USER_MESSAGE);
assert.ok(/support ticket/i.test(friendly));
assert.ok(/short while/i.test(friendly));
assert.ok(!/Agent run timed out/i.test(friendly));

console.log("User-facing agent error tests passed.");
