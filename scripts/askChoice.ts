import type { AlertButton } from "react-native";
import { showChoice } from "@/state/choice";

// Asks the listener to pick one of a few actions in the app's own dialog (ChoiceSheet); the
// web build shows a browser dialog
export function askChoice(title: string, message: string | undefined, buttons: AlertButton[]): void {
  showChoice({ title, message, buttons });
}
