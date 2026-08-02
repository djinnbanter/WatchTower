package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModErrorCategoryTest {

    @Test
    void createContraptionRequiresErrorNotChat() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[Server thread/ERROR] [create/]: Contraption collision failed at mf.axis");
        assertNotNull(hit);
        assertEquals(ModErrorCategory.CREATE_CONTRAPTION, hit.category());
        assertEquals("create", hit.primaryMod());

        assertNull(ModErrorCategory.classify(
                "[Server thread/INFO] [minecraft/]: <Player> create contraption looks cool"));
    }

    @Test
    void kubejsScriptRequiresErrorNotInfoReload() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[Server thread/ERROR] [KubeJS Server/]: Script error in server_scripts/foo.js");
        assertNotNull(hit);
        assertEquals(ModErrorCategory.KUBEJS_SCRIPT, hit.category());

        assertNull(ModErrorCategory.classify(
                "[Server thread/INFO] [KubeJS Server/]: Reloading server scripts / bindings"));
    }

    @Test
    void ae2GridError() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[Server thread/ERROR] [ae2/]: Grid channel network overflow");
        assertNotNull(hit);
        assertEquals(ModErrorCategory.AE2_GRID, hit.category());
        assertEquals("ae2", hit.primaryMod());
    }

    @Test
    void missingMigrationArrow() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "examplemod:old_block -> MISSING");
        assertNotNull(hit);
        assertEquals(ModErrorCategory.MOD_MISSING_MIGRATION, hit.category());
    }

    @Test
    void itemStackLoggerIsNotAMod() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[29Jun2026 16:47:22.626] [Server thread/ERROR] [net.minecraft.world.item.ItemStack/]: "
                        + "Tried to load invalid item: 'Item must not be minecraft:air'");
        assertNull(hit, "vanilla ItemStack logger must not become a mod log error");
        assertNull(ModErrorCategory.resolveLoggerModId("net.minecraft.world.item.ItemStack"));
        assertNull(ModErrorCategory.resolveLoggerModId("ItemStack"));
        assertNull(ModErrorCategory.resolveLoggerModId("blockattachedentity"));
    }

    @Test
    void realModLoggerStillAttributed() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[Server thread/ERROR] [someweirdmod/]: Something exploded");
        assertNotNull(hit);
        assertEquals("someweirdmod", hit.primaryMod());
    }

    @Test
    void kubejsFailedToParseRecipeWarnIsRecipeParse() {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(
                "[15:33:12] [WARN] KubeRecipe.java#90: Failed to parse recipe "
                        + "'createfood:create/filling/leather_soup_bowl_from_filling_leather_soup[create:filling]'! "
                        + "Falling back to vanilla: Failed to read required component");
        assertNotNull(hit, "KubeJS dump-style recipe WARN must classify");
        assertEquals("recipe_parse", hit.category().id());
        assertEquals("createfood", hit.primaryMod());
        assertEquals(
                "createfood:create/filling/leather_soup_bowl_from_filling_leather_soup[create:filling]",
                hit.recipeId());
    }
}
