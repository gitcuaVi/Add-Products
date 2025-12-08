// // ============= UNINSTALL =============
async function clearAllDbObjects() {
  try {
    console.log("🚨 Clearing specific DB objects...");

    // Các key tĩnh
    const staticKeys = ["marketList", "categoryList-đ", "categoryList-$"];

    // Các key động (pricebook theo id)
    const pricebookIds = [
      "50000100596", "50000100595", "50000100594", "50000100593",
      "50000100592", "50000100591", "50000100582", "50000100580",
      "50000100563", "50000100549", "50000100544", "50000100543",
      "50000100542", "50000100540", "50000100539", "50000100538",
      "50000100537", "50000100536", "50000100534", "50000100533",
      "50000100526", "50000100525", "50000100524", "50000100523",
      "50000100522", "50000100521", "50000100520", "50000100519",
      "50000100518", "50000100517", "50000100516", "50000100515",
      "50000100514", "50000100513", "50000100507", "50000100505",
      "50000100503", "50000100501", "50000100500", "50000100499",
      "50000100486", "50000100481", "50000100480", "50000100479",
      "50000101504"
    ];

    const pricebookKeys = pricebookIds.map(id => `pricebook-${id}`);

    // Gộp tất cả key lại
    const allKeys = [...staticKeys, ...pricebookKeys];

    // Xóa
    await Promise.all(allKeys.map(k => client.db.delete(k).catch(() => null)));

    console.log("✅ Cleared DB keys:", allKeys);
  } catch (err) {
    console.error("❌ Error clearing DB:", err);
  }
}