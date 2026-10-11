import { Alert } from "react-native";

// Shows a failed action's message in an alert; used as a promise's catch handler
export const showError = (title: string) => (err: unknown) =>
  Alert.alert(title, err instanceof Error ? err.message : String(err));
