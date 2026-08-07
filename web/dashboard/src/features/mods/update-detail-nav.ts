export function updateDetailRelatedTarget(
  modId: string,
  updateModIds: ReadonlySet<string>,
): { view: 'updates' | 'overview'; mod: string } {
  return {
    view: updateModIds.has(modId) ? 'updates' : 'overview',
    mod: modId,
  };
}
