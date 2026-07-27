package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Helpers for Spark call-tree payloads: full trees stay available for the tree API,
 * while profile JSON / fixtures use a slimmed preview so responses stay browser-sized.
 */
public final class SparkCallTrees {

    /** Embedded in {@code /api/spark/profile} for overview/window hints. */
    public static final int PROFILE_PREVIEW_NODES = 1_500;

    /** Golden fixture / mock size budget (pretty JSON stays git-friendly). */
    public static final int FIXTURE_PREVIEW_NODES = 1_500;

    private SparkCallTrees() {
    }

    /**
     * Returns a deep-copied tree capped at {@code maxNodes} nodes (thread roots + frames).
     * Prefer higher-involvement children (source order is already ranked by the parser).
     */
    public static JsonObject slim(JsonObject sourceTree, int maxNodes) {
        if (sourceTree == null) {
            return null;
        }
        int budget = Math.max(1, maxNodes);
        JsonObject out = new JsonObject();
        for (var entry : sourceTree.entrySet()) {
            if (!"threads".equals(entry.getKey())
                    && !"nodes_emitted".equals(entry.getKey())
                    && !"truncated".equals(entry.getKey())
                    && !"bounded".equals(entry.getKey())) {
                out.add(entry.getKey(), entry.getValue().deepCopy());
            }
        }
        SlimBudget slimBudget = new SlimBudget(budget);
        JsonArray threadsOut = new JsonArray();
        JsonArray threadsIn = sourceTree.has("threads") && sourceTree.get("threads").isJsonArray()
                ? sourceTree.getAsJsonArray("threads")
                : new JsonArray();
        for (JsonElement element : threadsIn) {
            if (!element.isJsonObject() || slimBudget.remaining <= 0) {
                slimBudget.truncated = true;
                break;
            }
            JsonObject slimThread = slimNode(element.getAsJsonObject(), slimBudget, true);
            if (slimThread != null) {
                threadsOut.add(slimThread);
            }
        }
        out.add("threads", threadsOut);
        out.addProperty("nodes_emitted", budget - slimBudget.remaining);
        boolean sourceTruncated = sourceTree.has("truncated")
                && sourceTree.get("truncated").isJsonPrimitive()
                && sourceTree.get("truncated").getAsBoolean();
        out.addProperty("truncated", slimBudget.truncated || sourceTruncated);
        out.addProperty("bounded", true);
        out.addProperty("preview", true);
        out.addProperty("preview_max_nodes", budget);
        return out;
    }

    private static JsonObject slimNode(JsonObject node, SlimBudget budget, boolean threadRoot) {
        if (!threadRoot) {
            if (budget.remaining <= 0) {
                budget.truncated = true;
                return null;
            }
            budget.remaining--;
        }
        JsonObject out = new JsonObject();
        for (var entry : node.entrySet()) {
            if (!"children".equals(entry.getKey()) && !"truncated_children".equals(entry.getKey())) {
                out.add(entry.getKey(), entry.getValue().deepCopy());
            }
        }
        JsonArray childrenIn = node.has("children") && node.get("children").isJsonArray()
                ? node.getAsJsonArray("children")
                : new JsonArray();
        JsonArray childrenOut = new JsonArray();
        int omitted = 0;
        for (JsonElement childEl : childrenIn) {
            if (!childEl.isJsonObject()) {
                continue;
            }
            if (budget.remaining <= 0) {
                omitted += 1;
                budget.truncated = true;
                continue;
            }
            JsonObject child = slimNode(childEl.getAsJsonObject(), budget, false);
            if (child == null) {
                omitted += 1;
                continue;
            }
            childrenOut.add(child);
        }
        // Count remaining siblings not visited when budget hit mid-loop.
        if (budget.truncated && omitted == 0 && childrenOut.size() < childrenIn.size()) {
            omitted = childrenIn.size() - childrenOut.size();
        }
        out.add("children", childrenOut);
        if (omitted > 0) {
            out.addProperty("truncated_children", omitted);
            budget.truncated = true;
        } else if (node.has("truncated_children")) {
            out.add("truncated_children", node.get("truncated_children").deepCopy());
            budget.truncated = true;
        }
        return out;
    }

    private static final class SlimBudget {
        private int remaining;
        private boolean truncated;

        private SlimBudget(int remaining) {
            this.remaining = remaining;
        }
    }
}
