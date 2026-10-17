import { Alert, AlertButton } from "react-native";

// Asks the listener to pick one of a few actions; the web build shows a browser dialog
export function askChoice(title: string, message: string | undefined, buttons: AlertButton[]): void {
  Alert.alert(title, message, buttons, { cancelable: true });
}
