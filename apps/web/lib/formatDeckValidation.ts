/** 保存時に表示するデッキ検証エラーのサマリー。 */
export function formatDeckValidationMessage(errors: string[]): string {
  if (errors.length === 0) {
    return "デッキが完成していません";
  }
  if (errors.length === 1) {
    return errors[0]!;
  }
  return `デッキが完成していません（${errors.length}件）:\n${errors.map((error) => `・${error}`).join("\n")}`;
}
