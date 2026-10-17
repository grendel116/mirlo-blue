// Shows a failed action's message in a browser alert; used as a promise's catch handler
export const showError = (title: string) => (err: unknown) =>
  window.alert(`${title}\n\n${err instanceof Error ? err.message : String(err)}`);
